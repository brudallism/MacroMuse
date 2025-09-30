// scripts/analyzeBundles.js - Bundle size analysis for React Native
const fs = require('fs')
const path = require('path')

class BundleAnalyzer {
  constructor() {
    this.bundleReport = {
      timestamp: new Date().toISOString(),
      totalSize: 0,
      features: {},
      recommendations: []
    }
  }

  async analyzeProject() {
    console.log('🔍 Starting bundle analysis...')

    // Analyze source code structure
    await this.analyzeSourceStructure()

    // Analyze dependencies
    await this.analyzeDependencies()

    // Generate recommendations
    this.generateRecommendations()

    // Output report
    this.outputReport()
  }

  async analyzeSourceStructure() {
    const sourceDir = path.join(__dirname, '../app')
    const features = ['ui', 'domain', 'infra', 'facades', 'state']

    for (const feature of features) {
      const featurePath = path.join(sourceDir, feature)
      if (fs.existsSync(featurePath)) {
        const stats = await this.getDirectoryStats(featurePath)
        this.bundleReport.features[feature] = stats
        this.bundleReport.totalSize += stats.totalSize
      }
    }
  }

  async getDirectoryStats(dirPath) {
    let totalSize = 0
    let fileCount = 0
    const files = []

    const scanDirectory = (dir) => {
      const items = fs.readdirSync(dir)

      for (const item of items) {
        const itemPath = path.join(dir, item)
        const stat = fs.statSync(itemPath)

        if (stat.isDirectory()) {
          // Skip node_modules and other non-source directories
          if (!item.startsWith('.') && item !== 'node_modules' && item !== '__tests__') {
            scanDirectory(itemPath)
          }
        } else if (item.match(/\.(ts|tsx|js|jsx)$/)) {
          const size = stat.size
          totalSize += size
          fileCount++

          const relativePath = path.relative(path.join(__dirname, '../app'), itemPath)
          files.push({
            path: relativePath,
            size,
            lines: this.countLines(itemPath)
          })
        }
      }
    }

    scanDirectory(dirPath)

    // Sort files by size (largest first)
    files.sort((a, b) => b.size - a.size)

    return {
      totalSize,
      fileCount,
      avgFileSize: fileCount > 0 ? Math.round(totalSize / fileCount) : 0,
      largestFiles: files.slice(0, 10),
      estimatedBundleImpact: this.estimateBundleImpact(totalSize, files)
    }
  }

  countLines(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      return content.split('\n').length
    } catch (error) {
      return 0
    }
  }

  estimateBundleImpact(totalSize, files) {
    // Rough estimation based on file types and complexity
    const jsFiles = files.filter(f => f.path.match(/\.(js|jsx)$/))
    const tsFiles = files.filter(f => f.path.match(/\.(ts|tsx)$/))

    // TypeScript files typically compile to slightly larger JS
    const estimatedJSSize = jsFiles.reduce((sum, f) => sum + f.size, 0)
    const estimatedTSSize = tsFiles.reduce((sum, f) => sum + f.size * 1.2, 0)

    return {
      estimatedMinified: Math.round((estimatedJSSize + estimatedTSSize) * 0.7),
      estimatedGzipped: Math.round((estimatedJSSize + estimatedTSSize) * 0.3),
      complexity: this.calculateComplexity(files)
    }
  }

  calculateComplexity(files) {
    let totalComplexity = 0

    for (const file of files) {
      // Simple complexity estimation based on file size and patterns
      let complexity = Math.min(file.lines / 50, 10) // Max 10 points for size

      // Add complexity for certain patterns (would need actual file analysis)
      if (file.path.includes('store')) complexity += 2
      if (file.path.includes('service')) complexity += 1
      if (file.path.includes('component')) complexity += 0.5

      totalComplexity += complexity
    }

    return Math.round(totalComplexity / files.length * 10) / 10
  }

  async analyzeDependencies() {
    try {
      const packageJsonPath = path.join(__dirname, '../package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      const heavyDependencies = []
      const potentialTreeShaking = []

      // Known heavy dependencies for React Native
      const knownHeavyPackages = {
        '@react-navigation/native': { size: '~200KB', impact: 'medium' },
        '@supabase/supabase-js': { size: '~300KB', impact: 'medium' },
        'react-native-vector-icons': { size: '~2MB', impact: 'high' },
        'lodash': { size: '~500KB', impact: 'high' },
        'moment': { size: '~200KB', impact: 'medium' },
        'date-fns': { size: '~100KB', impact: 'low' }
      }

      for (const [dep, version] of Object.entries(dependencies)) {
        if (knownHeavyPackages[dep]) {
          heavyDependencies.push({
            name: dep,
            version,
            ...knownHeavyPackages[dep]
          })
        }

        // Check for packages that support tree shaking
        if (dep.includes('lodash') || dep.includes('date-fns') || dep.includes('ramda')) {
          potentialTreeShaking.push(dep)
        }
      }

      this.bundleReport.dependencies = {
        total: Object.keys(dependencies).length,
        heavy: heavyDependencies,
        treeShakingOpportunities: potentialTreeShaking
      }

    } catch (error) {
      console.warn('Could not analyze dependencies:', error.message)
    }
  }

  generateRecommendations() {
    const recommendations = []

    // File size recommendations
    for (const [feature, stats] of Object.entries(this.bundleReport.features)) {
      if (stats.largestFiles && stats.largestFiles.length > 0) {
        const largeFiles = stats.largestFiles.filter(f => f.size > 10000) // > 10KB

        if (largeFiles.length > 0) {
          recommendations.push({
            type: 'file-size',
            severity: 'medium',
            message: `Large files detected in ${feature}`,
            details: largeFiles.map(f => `${f.path} (${Math.round(f.size / 1024)}KB)`),
            suggestion: 'Consider splitting large files or lazy loading components'
          })
        }
      }

      // Complexity recommendations
      if (stats.estimatedBundleImpact && stats.estimatedBundleImpact.complexity > 5) {
        recommendations.push({
          type: 'complexity',
          severity: 'medium',
          message: `High complexity detected in ${feature}`,
          suggestion: 'Consider refactoring complex components and extracting reusable logic'
        })
      }
    }

    // Dependency recommendations
    if (this.bundleReport.dependencies) {
      const { heavy, treeShakingOpportunities } = this.bundleReport.dependencies

      if (heavy.filter(d => d.impact === 'high').length > 0) {
        recommendations.push({
          type: 'dependencies',
          severity: 'high',
          message: 'Heavy dependencies detected',
          details: heavy.filter(d => d.impact === 'high').map(d => `${d.name} (${d.size})`),
          suggestion: 'Consider lighter alternatives or lazy loading these dependencies'
        })
      }

      if (treeShakingOpportunities.length > 0) {
        recommendations.push({
          type: 'tree-shaking',
          severity: 'low',
          message: 'Tree shaking opportunities available',
          details: treeShakingOpportunities,
          suggestion: 'Use named imports instead of importing entire libraries'
        })
      }
    }

    // Bundle size recommendations
    const estimatedTotalSize = Object.values(this.bundleReport.features)
      .reduce((sum, stats) => sum + (stats.estimatedBundleImpact?.estimatedMinified || 0), 0)

    if (estimatedTotalSize > 2000000) { // > 2MB
      recommendations.push({
        type: 'bundle-size',
        severity: 'high',
        message: 'Large bundle size detected',
        suggestion: 'Implement code splitting and lazy loading for non-critical features'
      })
    }

    this.bundleReport.recommendations = recommendations
  }

  outputReport() {
    const reportPath = path.join(__dirname, '../bundle-analysis-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(this.bundleReport, null, 2))

    console.log('\n📊 Bundle Analysis Report')
    console.log('========================')
    console.log(`Total source size: ${Math.round(this.bundleReport.totalSize / 1024)}KB`)

    console.log('\n📁 Feature breakdown:')
    for (const [feature, stats] of Object.entries(this.bundleReport.features)) {
      console.log(`  ${feature}: ${Math.round(stats.totalSize / 1024)}KB (${stats.fileCount} files)`)

      if (stats.estimatedBundleImpact) {
        console.log(`    Estimated minified: ${Math.round(stats.estimatedBundleImpact.estimatedMinified / 1024)}KB`)
        console.log(`    Estimated gzipped: ${Math.round(stats.estimatedBundleImpact.estimatedGzipped / 1024)}KB`)
      }
    }

    if (this.bundleReport.dependencies) {
      console.log(`\n📦 Dependencies: ${this.bundleReport.dependencies.total} total`)
      if (this.bundleReport.dependencies.heavy.length > 0) {
        console.log('  Heavy dependencies:')
        this.bundleReport.dependencies.heavy.forEach(dep => {
          console.log(`    ${dep.name}: ${dep.size} (${dep.impact} impact)`)
        })
      }
    }

    console.log('\n💡 Recommendations:')
    if (this.bundleReport.recommendations.length === 0) {
      console.log('  ✅ No major issues detected!')
    } else {
      this.bundleReport.recommendations.forEach((rec, index) => {
        const icon = rec.severity === 'high' ? '🚨' : rec.severity === 'medium' ? '⚠️' : 'ℹ️'
        console.log(`  ${icon} ${rec.message}`)
        console.log(`     ${rec.suggestion}`)
        if (rec.details && rec.details.length > 0) {
          console.log(`     Details: ${rec.details.slice(0, 3).join(', ')}${rec.details.length > 3 ? '...' : ''}`)
        }
        console.log()
      })
    }

    console.log(`\n📄 Detailed report saved to: ${reportPath}`)
  }
}

// Feature-specific bundle targets (following Foundation.md principles)
const BUNDLE_TARGETS = {
  'core': 500, // KB - Essential app functionality
  'search': 300, // KB - Food search and logging
  'analytics': 400, // KB - Analytics and insights
  'recipes': 350, // KB - Recipe management
  'planning': 300, // KB - Meal planning
  'barcode': 200, // KB - Barcode scanning
}

class BundleTargetValidator {
  static validateTargets(analysisReport) {
    const violations = []

    for (const [feature, target] of Object.entries(BUNDLE_TARGETS)) {
      const featureStats = analysisReport.features[feature]
      if (featureStats) {
        const actualSize = Math.round(featureStats.estimatedBundleImpact?.estimatedMinified / 1024) || 0

        if (actualSize > target) {
          violations.push({
            feature,
            target,
            actual: actualSize,
            excess: actualSize - target
          })
        }
      }
    }

    return violations
  }
}

// Run analysis if called directly
if (require.main === module) {
  const analyzer = new BundleAnalyzer()
  analyzer.analyzeProject().catch(console.error)
}

module.exports = { BundleAnalyzer, BundleTargetValidator, BUNDLE_TARGETS }
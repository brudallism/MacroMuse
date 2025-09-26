// molecules/MacroRing.tsx - Dashboard macro progress rings
import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'

import { Text } from '../atoms/Text'
import { theme } from '../theme/tokens'

interface MacroRingProps {
  label: string
  current: number
  target: number
  percentage: number
  color: string
  size?: number
  strokeWidth?: number
}

export function MacroRing({
  label,
  current,
  target,
  percentage,
  color,
  size = 120,
  strokeWidth = 8,
}: MacroRingProps): JSX.Element {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  const center = size / 2

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.colors.neutral[200]}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />

        {/* Center text - Current value */}
        <SvgText
          x={center}
          y={center - 6}
          textAnchor="middle"
          fontSize="18"
          fontWeight="600"
          fill={theme.colors.text.primary}
        >
          {Math.round(current)}
        </SvgText>

        {/* Center text - Target value */}
        <SvgText
          x={center}
          y={center + 12}
          textAnchor="middle"
          fontSize="12"
          fill={theme.colors.text.secondary}
        >
          / {Math.round(target)}
        </SvgText>
      </Svg>

      <View style={styles.labelContainer}>
        <Text variant="caption" color="secondary" align="center">
          {label}
        </Text>
        <Text variant="caption" color="tertiary" align="center">
          {percentage}%
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
  },
  labelContainer: {
    position: 'absolute',
    bottom: -theme.spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
})
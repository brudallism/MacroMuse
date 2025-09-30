// ui/molecules/RecipeBasicInfo.tsx - Basic recipe information component
import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Card } from '../atoms/Card'
import { Text } from '../atoms/Text'
import { TextInput } from '../atoms/TextInput'
import { Button } from '../atoms/Button'
import { RecipeData } from '../../domain/models'
import { useTheme } from '../theme/ThemeProvider'

interface RecipeBasicInfoProps {
  data: RecipeData
  onChange?: (updates: Partial<RecipeData>) => void
  readonly?: boolean
  onScale?: (newServings: number) => void
}

export const RecipeBasicInfo: React.FC<RecipeBasicInfoProps> = ({
  data,
  onChange,
  readonly = false,
  onScale
}) => {
  const theme = useTheme()

  const handleFieldChange = (field: keyof RecipeData, value: any) => {
    if (readonly || !onChange) return
    onChange({ [field]: value })
  }

  const handleServingsChange = (newServings: string) => {
    const servings = parseInt(newServings, 10)
    if (isNaN(servings) || servings <= 0) return

    if (data.servings !== servings) {
      onScale?.(servings)
    }
  }

  const difficultyOptions = [
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' }
  ]

  return (
    <Card style={styles.container}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Basic Information
      </Text>

      {/* Recipe Name */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Recipe Name *
        </Text>
        {readonly ? (
          <Text style={[styles.value, { color: theme.colors.text }]}>
            {data.name || 'Untitled Recipe'}
          </Text>
        ) : (
          <TextInput
            value={data.name}
            onChangeText={(value) => handleFieldChange('name', value)}
            placeholder="Enter recipe name"
            style={styles.input}
          />
        )}
      </View>

      {/* Description */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Description
        </Text>
        {readonly ? (
          <Text style={[styles.value, { color: theme.colors.textSecondary }]}>
            {data.description || 'No description provided'}
          </Text>
        ) : (
          <TextInput
            value={data.description || ''}
            onChangeText={(value) => handleFieldChange('description', value)}
            placeholder="Describe your recipe (optional)"
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea]}
          />
        )}
      </View>

      {/* Servings and Times Row */}
      <View style={styles.row}>
        {/* Servings */}
        <View style={[styles.field, styles.fieldHalf]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Servings *
          </Text>
          {readonly ? (
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {data.servings}
            </Text>
          ) : (
            <TextInput
              value={data.servings.toString()}
              onChangeText={handleServingsChange}
              placeholder="1"
              keyboardType="numeric"
              style={[styles.input, styles.smallInput]}
            />
          )}
        </View>

        {/* Prep Time */}
        <View style={[styles.field, styles.fieldHalf]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Prep Time (min)
          </Text>
          {readonly ? (
            <Text style={[styles.value, { color: theme.colors.textSecondary }]}>
              {data.prepTime ? `${data.prepTime} min` : 'Not specified'}
            </Text>
          ) : (
            <TextInput
              value={data.prepTime?.toString() || ''}
              onChangeText={(value) => handleFieldChange('prepTime', parseInt(value) || 0)}
              placeholder="0"
              keyboardType="numeric"
              style={[styles.input, styles.smallInput]}
            />
          )}
        </View>
      </View>

      <View style={styles.row}>
        {/* Cook Time */}
        <View style={[styles.field, styles.fieldHalf]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Cook Time (min)
          </Text>
          {readonly ? (
            <Text style={[styles.value, { color: theme.colors.textSecondary }]}>
              {data.cookTime ? `${data.cookTime} min` : 'Not specified'}
            </Text>
          ) : (
            <TextInput
              value={data.cookTime?.toString() || ''}
              onChangeText={(value) => handleFieldChange('cookTime', parseInt(value) || 0)}
              placeholder="0"
              keyboardType="numeric"
              style={[styles.input, styles.smallInput]}
            />
          )}
        </View>

        {/* Difficulty */}
        <View style={[styles.field, styles.fieldHalf]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Difficulty
          </Text>
          {readonly ? (
            <Text style={[styles.value, { color: theme.colors.textSecondary }]}>
              {data.difficulty ? data.difficulty.charAt(0).toUpperCase() + data.difficulty.slice(1) : 'Not specified'}
            </Text>
          ) : (
            <View style={styles.difficultyButtons}>
              {difficultyOptions.map((option) => (
                <Button
                  key={option.value}
                  title={option.label}
                  onPress={() => handleFieldChange('difficulty', option.value)}
                  variant={data.difficulty === option.value ? 'primary' : 'outline'}
                  style={styles.difficultyButton}
                />
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Tags */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Tags
        </Text>
        {readonly ? (
          <View style={styles.tagsDisplay}>
            {data.tags.length > 0 ? (
              data.tags.map((tag, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Text style={[styles.tagText, { color: theme.colors.primary }]}>
                    {tag}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.value, { color: theme.colors.textSecondary }]}>
                No tags
              </Text>
            )}
          </View>
        ) : (
          <TextInput
            value={data.tags.join(', ')}
            onChangeText={(value) => {
              const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
              handleFieldChange('tags', tags)
            }}
            placeholder="Enter tags separated by commas (e.g., vegetarian, quick, healthy)"
            style={styles.input}
          />
        )}
      </View>

      {/* Total Time Display */}
      {(data.prepTime || data.cookTime) && (
        <View style={styles.totalTimeContainer}>
          <Text style={[styles.totalTimeLabel, { color: theme.colors.textSecondary }]}>
            Total Time: {(data.prepTime || 0) + (data.cookTime || 0)} minutes
          </Text>
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  fieldHalf: {
    flex: 1,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
  },
  input: {
    // Input styling handled by TextInput component
  },
  smallInput: {
    // For numeric inputs
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  difficultyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  difficultyButton: {
    flex: 1,
    marginHorizontal: 2,
  },
  tagsDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  totalTimeContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  totalTimeLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
})
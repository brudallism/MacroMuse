import React from 'react'
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'

import { Text } from '@ui/atoms/Text'
import { Icon } from '@ui/atoms/Icon'
import { useTheme } from '@ui/theme/ThemeProvider'

export interface Tab {
  key: string
  title: string
  icon?: string
}

export interface TabViewProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tab: string) => void
  style?: any
}

export const TabView: React.FC<TabViewProps> = ({
  tabs,
  activeTab,
  onTabChange,
  style
}) => {
  const theme = useTheme()

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key

          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                {
                  borderBottomColor: isActive
                    ? theme.colors.primary
                    : 'transparent',
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => onTabChange(tab.key)}
            >
              {tab.icon && (
                <Icon
                  name={tab.icon}
                  size={18}
                  color={isActive ? theme.colors.primary : theme.colors.gray[500]}
                  style={styles.tabIcon}
                />
              )}
              <Text
                style={[
                  styles.tabText,
                  {
                    color: isActive ? theme.colors.primary : theme.colors.gray[500],
                    fontWeight: isActive ? '600' : '400',
                  },
                ]}
              >
                {tab.title}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
  },
})
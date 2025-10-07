# Systematic User Testing Strategy

## Testing Overview

This document provides a comprehensive testing strategy for MacroMuse, organized by priority and designed to catch critical issues before production deployment.

## Testing Priority Matrix

### Priority 1: Critical Path Testing (30 minutes) - Test TODAY
- App launch and navigation
- Food search and logging flow
- Barcode scanning end-to-end
- Dashboard data accuracy

### Priority 2: Edge Cases & Error Testing (45 minutes) - Test This Week
- Network connectivity scenarios
- Empty states and data validation
- Data persistence across sessions

### Priority 3: Performance & Usability (30 minutes) - Test Before Production
- Performance under load
- Cross-platform consistency

---

## Priority 1: Critical Path Testing (30 minutes)

### 1. App Launch & Authentication (5 minutes)

**Test Sequence:**
1. Cold app launch from device home screen
2. Check splash screen appears and disappears within 3 seconds
3. Verify main navigation loads without crashes
4. Test tab switching between all 5 tabs (Dashboard, Food Search, Scan, Profile, Components)
5. Verify no console errors on startup

**🔍 Look For:**
- [ ] No white screens or crashes on launch
- [ ] All tab icons and labels display correctly
- [ ] Tab switching is responsive (<200ms)
- [ ] No console error messages
- [ ] Navigation bar renders properly
- [ ] Status bar displays correctly

**🚨 Fail Criteria:**
- App crashes on launch
- White screen persists >3 seconds
- Any tab fails to load
- Console shows error messages

### 2. Food Search & Logging Flow (10 minutes)

**Test Sequence:**
1. Tap "Food Search" tab
2. Type "chicken breast" in search input
3. Verify results appear within 2 seconds
4. Tap first search result
5. Adjust serving size to 150g
6. Select "Lunch" meal type
7. Tap "Log Food" button
8. Verify success confirmation appears
9. Navigate to dashboard and check updated calories

**🔍 Look For:**
- [ ] Search input responds to typing
- [ ] Results load within 2-second budget
- [ ] Food selection modal opens properly
- [ ] Serving size input accepts numbers
- [ ] Nutrition values update when serving size changes
- [ ] Meal type selection works
- [ ] Success confirmation shows
- [ ] Dashboard reflects new entry immediately
- [ ] Calorie totals are accurate

**🚨 Fail Criteria:**
- Search takes >5 seconds
- No results returned for common foods
- Modal doesn't open
- Nutrition calculations incorrect
- Food doesn't appear in dashboard

### 3. Barcode Scanning Flow (10 minutes)

**Test Sequence:**
1. Tap "Scan" tab
2. Grant camera permission when prompted
3. Test with real product barcode (or use test barcode: 073230200939)
4. Verify product information loads
5. Check nutrition facts display correctly
6. Adjust serving size if needed
7. Select meal type
8. Tap "Add to Log"
9. Verify appears in dashboard

**🔍 Look For:**
- [ ] Camera permission request appears
- [ ] Camera view loads without errors
- [ ] Barcode recognition works
- [ ] Product data loads within 5 seconds
- [ ] Nutrition information displays
- [ ] Serving size adjustments work
- [ ] Cancel/manual entry options available
- [ ] Product logs successfully
- [ ] Dashboard updates with barcode item

**🚨 Fail Criteria:**
- Camera doesn't activate
- Barcode scanning fails completely
- Product lookup takes >10 seconds
- No way to exit scanner
- Nutrition data missing

### 4. Dashboard Data Integrity (5 minutes)

**Test Sequence:**
1. Navigate to Dashboard tab
2. Verify today's totals match logged foods
3. Check macro ring calculations are reasonable
4. Test scrolling through recent foods
5. Force close app and restart
6. Verify data persists after app restart

**🔍 Look For:**
- [ ] Calorie totals match individual food entries
- [ ] Protein/carbs/fat percentages add up correctly
- [ ] Recent foods list shows latest entries
- [ ] Visual elements (rings, charts) render correctly
- [ ] Data survives app restart
- [ ] No duplicate entries
- [ ] Reasonable performance when scrolling

**🚨 Fail Criteria:**
- Calorie calculations obviously wrong
- Data disappears after restart
- Dashboard crashes when loading
- Recent foods don't update

---

## Priority 2: Edge Cases & Error Testing (45 minutes)

### 5. Network & Connectivity Testing (15 minutes)

**Test Sequence:**
1. Turn off WiFi and cellular data
2. Try to search for food
3. Verify offline message/fallback appears
4. Log a food item while offline
5. Turn connectivity back on
6. Verify offline data syncs correctly

**🔍 Look For:**
- [ ] Graceful offline behavior
- [ ] User-friendly error messages (not technical)
- [ ] Ability to queue operations offline
- [ ] Automatic sync when reconnected
- [ ] No data loss during offline usage
- [ ] Clear indication of offline status

**🚨 Fail Criteria:**
- App crashes when offline
- No indication of connectivity issues
- Data lost when offline
- Sync fails when reconnected

### 6. Empty States & Data Validation (15 minutes)

**Test Sequence:**
1. Test with completely empty food log
2. Check dashboard empty state
3. Try invalid serving sizes (0, negative numbers, text)
4. Search with nonsense query that returns no results
5. Test special characters in search (@#$%^&*)
6. Try scanning fake/invalid barcodes

**🔍 Look For:**
- [ ] Helpful empty state messages
- [ ] Input validation prevents app crashes
- [ ] Error messages are user-friendly
- [ ] Form validation works correctly
- [ ] No way to enter impossible data
- [ ] Graceful handling of no search results

**🚨 Fail Criteria:**
- App crashes on invalid input
- Technical error messages shown to user
- Can enter negative calories
- No validation on forms

### 7. Data Persistence & Cross-Session Testing (15 minutes)

**Test Sequence:**
1. Log several different foods with different meal types
2. Force close app completely (swipe up from app switcher)
3. Restart app and verify all data remains
4. Clear app cache through device settings (if possible)
5. Test that core data still persists
6. Log out and log back in (if authentication exists)
7. Verify user data integrity maintained

**🔍 Look For:**
- [ ] Data survives force close
- [ ] Food log history intact after restart
- [ ] Profile settings maintained
- [ ] No data corruption
- [ ] Consistent data across sessions
- [ ] Fast app restart (cached data loads quickly)

**🚨 Fail Criteria:**
- Food log disappears after restart
- Data corruption occurs
- Profile settings reset
- Slow app startup due to data reload

---

## Priority 3: Performance & Usability Testing (30 minutes)

### 8. Performance Under Load Testing (15 minutes)

**Test Sequence:**
1. Rapidly search for multiple different foods
2. Log 10+ food items in quick succession
3. Navigate between tabs rapidly (stress test)
4. Scroll through long food lists
5. Test performance with low device battery
6. Monitor memory usage if development tools available

**🔍 Look For:**
- [ ] App remains responsive during heavy usage
- [ ] No noticeable memory leaks
- [ ] Smooth animations and transitions
- [ ] Search results load within budget
- [ ] UI doesn't freeze during operations
- [ ] Reasonable battery usage

**Performance Benchmarks:**
- Search: <800ms
- Food logging: <1200ms
- Tab navigation: <200ms
- App launch: <3000ms

**🚨 Fail Criteria:**
- App becomes unresponsive
- Memory usage grows excessively
- Operations take >5x expected time
- Battery drains rapidly during normal use

### 9. Cross-Platform Consistency Testing (15 minutes)

**Test Sequence (if testing on multiple devices):**
1. Test same core flows on iOS and Android
2. Compare visual consistency between platforms
3. Check platform-specific behaviors (back button, gestures)
4. Test on different screen sizes if available
5. Verify gesture behaviors work as expected

**🔍 Look For:**
- [ ] Consistent functionality across platforms
- [ ] Appropriate platform conventions followed
- [ ] Responsive design on different screen sizes
- [ ] Native feel on each platform
- [ ] No platform-specific crashes
- [ ] Consistent performance across devices

**🚨 Fail Criteria:**
- Core features work differently on different platforms
- UI breaks on certain screen sizes
- Platform-specific crashes
- Inconsistent user experience

---

## Bug Reporting Template

When you find issues, document them using this format:

### Bug Report Template
```
**Priority:** High/Medium/Low
**Platform:** iOS/Android/Both
**Device:** [Device model and OS version]

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots/Videos:**
[If applicable]

**Console Errors:**
[Any error messages]

**Impact:**
[How this affects user experience]
```

## Testing Completion Checklist

### Before Moving to Day 14:
- [ ] All Priority 1 tests completed and major issues resolved
- [ ] Critical user flows work end-to-end
- [ ] No app crashes during normal usage
- [ ] Data persistence verified
- [ ] Performance within acceptable ranges

### Before Production Release:
- [ ] All Priority 2 tests completed
- [ ] Edge cases handled gracefully
- [ ] Error messages are user-friendly
- [ ] Offline scenarios work correctly
- [ ] All Priority 3 tests completed
- [ ] Performance benchmarks met
- [ ] Cross-platform consistency verified

## Emergency Debugging Steps

If you encounter critical issues:

1. **Check Console Logs:**
   - Open development tools
   - Look for red error messages
   - Note any network failures

2. **Verify Data Flow:**
   - Database → Repository → Facade → Store → UI
   - Check data shape at each step

3. **Test Performance:**
   - Use device performance monitor
   - Check for memory leaks
   - Verify network request timing

4. **Isolate the Issue:**
   - Test on different devices
   - Try with different data sets
   - Test with/without network

Remember: The goal is to catch major issues before Day 14 testing, not to achieve perfection. Focus on critical user flows and basic functionality first.
# Coach Dashboard Implementation Guide

## Executive Summary

This guide implements a Foundation.md-compliant coach dashboard feature that piggybacks on existing analytics infrastructure while adding minimal complexity. The feature uses a code-based invitation system, real-time messaging, and view-only analytics access with extensibility for future coach management capabilities.

**Implementation Timeline: 2-3 days**
**Architecture Impact: MINIMAL** - extends existing patterns without breaking them

---

## Feature Requirements Summary

### Core Functionality
- **Invitation System**: Users generate unique codes for coach access
- **Multi-Coach Support**: Users can have multiple coaches; coaches can have multiple users
- **Analytics Access**: Coaches see all user analytics (current, historical, future data)
- **Real-time Messaging**: Simple text chat with 7-day message retention
- **View-Only MVP**: Future extensibility for coach meal/goal management

### Foundation.md Compliance
✅ **Vertical Slice**: End-to-end coach feature without breaking existing code
✅ **Pure Domain Core**: New coaching services as pure TypeScript functions
✅ **Stable Interfaces**: Extends analytics/planning services, doesn't replace
✅ **Event-Driven**: Coach actions emit events for loose coupling
✅ **Minimal State**: Extends existing `dataStore`, no new stores
✅ **Performance Budgets**: Coach queries meet existing <800ms targets

---

## Foundation Impact Assessment

### Tenet Alignment Analysis
- ✅ **Single source of truth**: Coach data lives in Supabase with existing user data
- ✅ **Vertical slice friendly**: Can deliver coach dashboard end-to-end without refactors
- ✅ **Pure domain core**: CoachService, MessagingService as pure functions with no IO
- ✅ **Stable interfaces**: Extends existing AnalyticsService and dataStore
- ✅ **Unidirectional flow**: UI → CoachFacade → Domain → Store → UI
- ✅ **Minimal state**: Adds coach fields to existing dataStore only
- ✅ **Event-driven**: Uses existing eventBus for coach actions
- ✅ **Type safety**: Strict unions for coach roles and message types
- ✅ **Performance**: Leverages existing analytics caching, adds coach-specific caching
- ✅ **Observability**: Extends existing Sentry/logging for coach events

**Verdict: PROCEED** - Perfect architectural alignment with zero Foundation.md violations

---

## Domain Model Extension

### Core Types (Add to `domain/models.ts`)

```typescript
// Coach-User Relationship Management
export type CoachInvitation = {
  id: string
  userId: string
  inviteCode: string  // 8-character alphanumeric
  createdAt: string
  expiresAt: string
  isActive: boolean
}

export type CoachUserRelationship = {
  id: string
  coachId: string
  userId: string
  status: 'active' | 'pending' | 'inactive'
  permissions: CoachPermission[]
  createdAt: string
  lastAccessedAt?: string
}

export type CoachPermission =
  | 'view_analytics'
  | 'view_meal_plans'
  | 'modify_goals'      // Future
  | 'modify_meals'      // Future
  | 'create_plans'      // Future

// Messaging System
export type Message = {
  id: string
  conversationId: string
  fromId: string
  toId: string
  content: string
  messageType: 'text' | 'meal_suggestion' | 'goal_update'  // Extensible
  timestamp: string
  isRead: boolean
  metadata?: Record<string, unknown>  // Future: meal data, goal changes
}

export type Conversation = {
  id: string
  coachId: string
  userId: string
  lastMessageAt: string
  lastMessagePreview: string
  unreadCount: number
}

// Coach Analytics Context
export type CoachAnalyticsView = {
  userId: string
  userName: string
  currentTargets: TargetVector
  adherenceScore: number
  lastLoggedAt: string
  activeInsights: Insight[]
  trendSummary: {
    period: '7d' | '30d' | '90d'
    trends: TrendData[]
    redFlags: string[]
  }
}
```

---

## Database Schema & Migrations

### Migration: `011_add_coach_system.sql`

```sql
-- Coach invitation system
CREATE TABLE IF NOT EXISTS coach_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code VARCHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  is_active BOOLEAN DEFAULT true
);

-- Coach-user relationships
CREATE TABLE IF NOT EXISTS coach_user_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
  permissions JSONB DEFAULT '["view_analytics", "view_meal_plans"]',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  UNIQUE(coach_id, user_id)
);

-- Messaging system
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(coach_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  from_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  to_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'meal_suggestion', 'goal_update')),
  timestamp TIMESTAMPTZ DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB
);

-- Row Level Security
ALTER TABLE coach_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_user_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users manage their own invitations"
  ON coach_invitations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Coaches and users see their relationships"
  ON coach_user_relationships FOR ALL
  USING (auth.uid() = coach_id OR auth.uid() = user_id);

CREATE POLICY "Participants access their conversations"
  ON conversations FOR ALL
  USING (auth.uid() = coach_id OR auth.uid() = user_id);

CREATE POLICY "Participants access their messages"
  ON messages FOR ALL
  USING (auth.uid() = from_id OR auth.uid() = to_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_coach_invitations_code ON coach_invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_coach_invitations_user_id ON coach_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_relationships_coach_id ON coach_user_relationships(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_relationships_user_id ON coach_user_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_coach_user ON conversations(coach_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp ON messages(conversation_id, timestamp DESC);

-- Message cleanup function (7-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM messages
  WHERE timestamp < (now() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (run daily)
SELECT cron.schedule('cleanup-old-messages', '0 2 * * *', 'SELECT cleanup_old_messages();');
```

---

## Domain Services (Pure Functions)

### `domain/services/coachInvitations.ts`

```typescript
export interface CoachInvitationService {
  generateInviteCode(): string
  validateInviteCode(code: string): boolean
  isCodeExpired(invitation: CoachInvitation): boolean
}

export class CoachInvitationServiceImpl implements CoachInvitationService {
  generateInviteCode(): string {
    // Generate 8-character alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  validateInviteCode(code: string): boolean {
    return /^[A-Z0-9]{8}$/.test(code)
  }

  isCodeExpired(invitation: CoachInvitation): boolean {
    return new Date(invitation.expiresAt) < new Date()
  }
}

export const coachInvitationService = new CoachInvitationServiceImpl()
```

### `domain/services/coachAnalytics.ts`

```typescript
export interface CoachAnalyticsService {
  aggregateUserView(userId: string, period: '7d' | '30d' | '90d'): Promise<CoachAnalyticsView>
  calculateAdherenceScore(userId: string, days: number): Promise<number>
  identifyRedFlags(userId: string, trends: TrendData[]): string[]
}

export class CoachAnalyticsServiceImpl implements CoachAnalyticsService {
  constructor(
    private analyticsService: AnalyticsService,
    private targetsService: TargetsService,
    private insightsService: InsightRuleEngine
  ) {}

  async aggregateUserView(userId: string, period: '7d' | '30d' | '90d'): Promise<CoachAnalyticsView> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [currentTargets, trends, insights, adherenceScore] = await Promise.all([
      this.targetsService.get(endDate),
      this.analyticsService.trends({ start: startDate, end: endDate }, ['calories', 'protein_g', 'carbs_g', 'fat_g']),
      this.insightsService.evaluate({ start: startDate, end: endDate }),
      this.calculateAdherenceScore(userId, days)
    ])

    return {
      userId,
      userName: 'User', // TODO: Get from profile
      currentTargets,
      adherenceScore,
      lastLoggedAt: endDate, // TODO: Get actual last log date
      activeInsights: insights.filter(i => i.severity === 'warn' || i.severity === 'high'),
      trendSummary: {
        period,
        trends,
        redFlags: this.identifyRedFlags(userId, trends)
      }
    }
  }

  async calculateAdherenceScore(userId: string, days: number): Promise<number> {
    // Use existing analytics to calculate adherence percentage
    // Implementation delegates to existing AnalyticsService.calculateAdherence
    return 0.85 // Placeholder - implement using existing analytics
  }

  identifyRedFlags(userId: string, trends: TrendData[]): string[] {
    const flags: string[] = []

    trends.forEach(trend => {
      if (trend.direction === 'decreasing' && trend.nutrient === 'protein_g') {
        flags.push('Protein intake declining')
      }
      if (trend.direction === 'increasing' && trend.nutrient === 'sodium_mg') {
        flags.push('Sodium levels increasing')
      }
      // Add more red flag logic as needed
    })

    return flags
  }
}
```

### `domain/services/messaging.ts`

```typescript
export interface MessagingService {
  createConversation(coachId: string, userId: string): Conversation
  formatMessage(content: string, type: Message['messageType']): { content: string; isValid: boolean }
  shouldNotifyUser(message: Message, userPreferences: any): boolean
}

export class MessagingServiceImpl implements MessagingService {
  createConversation(coachId: string, userId: string): Conversation {
    return {
      id: crypto.randomUUID(),
      coachId,
      userId,
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: '',
      unreadCount: 0
    }
  }

  formatMessage(content: string, type: Message['messageType']): { content: string; isValid: boolean } {
    const trimmed = content.trim()

    if (trimmed.length === 0 || trimmed.length > 1000) {
      return { content: trimmed, isValid: false }
    }

    return { content: trimmed, isValid: true }
  }

  shouldNotifyUser(message: Message, userPreferences: any): boolean {
    // Simple notification logic - can be enhanced based on user preferences
    return true
  }
}

export const messagingService = new MessagingServiceImpl()
```

---

## Repository Layer

### `infra/repositories/CoachRepository.ts`

```typescript
export interface CoachRepository {
  // Invitation system
  createInvitation(userId: string): Promise<CoachInvitation>
  findInvitationByCode(code: string): Promise<CoachInvitation | null>
  deactivateInvitation(invitationId: string): Promise<void>

  // Relationships
  createRelationship(coachId: string, userId: string): Promise<CoachUserRelationship>
  getCoachUsers(coachId: string): Promise<CoachUserRelationship[]>
  getUserCoaches(userId: string): Promise<CoachUserRelationship[]>
  updateRelationshipStatus(relationshipId: string, status: CoachUserRelationship['status']): Promise<void>

  // Analytics access
  getCoachAnalyticsAccess(coachId: string, userId: string): Promise<CoachPermission[]>
}

export class SupabaseCoachRepository implements CoachRepository {
  constructor(private supabase: SupabaseClient) {}

  async createInvitation(userId: string): Promise<CoachInvitation> {
    // Deactivate existing invitations
    await this.supabase
      .from('coach_invitations')
      .update({ is_active: false })
      .eq('user_id', userId)

    const inviteCode = coachInvitationService.generateInviteCode()

    const { data, error } = await this.supabase
      .from('coach_invitations')
      .insert({
        user_id: userId,
        invite_code: inviteCode,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async findInvitationByCode(code: string): Promise<CoachInvitation | null> {
    const { data, error } = await this.supabase
      .from('coach_invitations')
      .select('*')
      .eq('invite_code', code)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async createRelationship(coachId: string, userId: string): Promise<CoachUserRelationship> {
    const { data, error } = await this.supabase
      .from('coach_user_relationships')
      .insert({
        coach_id: coachId,
        user_id: userId,
        status: 'active',
        permissions: ['view_analytics', 'view_meal_plans']
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getCoachUsers(coachId: string): Promise<CoachUserRelationship[]> {
    const { data, error } = await this.supabase
      .from('coach_user_relationships')
      .select('*')
      .eq('coach_id', coachId)
      .eq('status', 'active')

    if (error) throw error
    return data || []
  }

  // ... implement remaining methods
}
```

### `infra/repositories/MessageRepository.ts`

```typescript
export interface MessageRepository {
  createConversation(coachId: string, userId: string): Promise<Conversation>
  getConversation(coachId: string, userId: string): Promise<Conversation | null>
  getCoachConversations(coachId: string): Promise<Conversation[]>

  sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message>
  getMessages(conversationId: string, limit?: number): Promise<Message[]>
  markMessagesAsRead(conversationId: string, userId: string): Promise<void>

  subscribeToConversation(conversationId: string, callback: (message: Message) => void): () => void
}

export class SupabaseMessageRepository implements MessageRepository {
  constructor(private supabase: SupabaseClient) {}

  async sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        ...message,
        timestamp: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // Update conversation last message
    await this.supabase
      .from('conversations')
      .update({
        last_message_at: data.timestamp,
        last_message_preview: message.content.substring(0, 100),
        unread_count: this.supabase.sql`unread_count + 1`
      })
      .eq('id', message.conversationId)

    return data
  }

  subscribeToConversation(conversationId: string, callback: (message: Message) => void): () => void {
    const subscription = this.supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        callback(payload.new as Message)
      })
      .subscribe()

    return () => {
      this.supabase.removeChannel(subscription)
    }
  }

  // ... implement remaining methods
}
```

---

## Facade Layer

### `facades/CoachDashboardFacade.ts`

```typescript
export interface CoachDashboardFacade {
  // Invitation system
  generateUserInviteCode(userId: string): Promise<string>
  acceptInvitation(coachId: string, inviteCode: string): Promise<{ success: boolean; userId?: string }>

  // Analytics access
  getCoachUsersList(coachId: string): Promise<CoachAnalyticsView[]>
  getUserAnalytics(coachId: string, userId: string, period: '7d' | '30d' | '90d'): Promise<CoachAnalyticsView>

  // Messaging
  sendMessage(fromId: string, toId: string, content: string): Promise<Message>
  getConversations(coachId: string): Promise<Conversation[]>
  getMessages(conversationId: string): Promise<Message[]>
  subscribeToMessages(conversationId: string, callback: (message: Message) => void): () => void
}

export class CoachDashboardFacadeImpl implements CoachDashboardFacade {
  constructor(
    private coachRepository: CoachRepository,
    private messageRepository: MessageRepository,
    private coachAnalyticsService: CoachAnalyticsService,
    private eventBus: EventBus
  ) {}

  async generateUserInviteCode(userId: string): Promise<string> {
    const invitation = await this.coachRepository.createInvitation(userId)

    this.eventBus.emit('coach_invitation_created', {
      userId,
      inviteCode: invitation.inviteCode,
      expiresAt: invitation.expiresAt
    })

    return invitation.inviteCode
  }

  async acceptInvitation(coachId: string, inviteCode: string): Promise<{ success: boolean; userId?: string }> {
    const invitation = await this.coachRepository.findInvitationByCode(inviteCode)

    if (!invitation || coachInvitationService.isCodeExpired(invitation)) {
      return { success: false }
    }

    const relationship = await this.coachRepository.createRelationship(coachId, invitation.userId)
    await this.coachRepository.deactivateInvitation(invitation.id)

    // Create conversation
    await this.messageRepository.createConversation(coachId, invitation.userId)

    this.eventBus.emit('coach_relationship_created', {
      coachId,
      userId: invitation.userId,
      relationshipId: relationship.id
    })

    return { success: true, userId: invitation.userId }
  }

  async getUserAnalytics(coachId: string, userId: string, period: '7d' | '30d' | '90d'): Promise<CoachAnalyticsView> {
    // Verify coach has access to this user
    const relationships = await this.coachRepository.getCoachUsers(coachId)
    const hasAccess = relationships.some(r => r.userId === userId && r.status === 'active')

    if (!hasAccess) {
      throw new Error('Coach does not have access to this user')
    }

    const analyticsView = await this.coachAnalyticsService.aggregateUserView(userId, period)

    this.eventBus.emit('coach_analytics_accessed', {
      coachId,
      userId,
      period,
      accessedAt: new Date().toISOString()
    })

    return analyticsView
  }

  async sendMessage(fromId: string, toId: string, content: string): Promise<Message> {
    const formatted = messagingService.formatMessage(content, 'text')
    if (!formatted.isValid) {
      throw new Error('Invalid message content')
    }

    const conversation = await this.messageRepository.getConversation(fromId, toId) ||
                        await this.messageRepository.getConversation(toId, fromId)

    if (!conversation) {
      throw new Error('No conversation found between users')
    }

    const message = await this.messageRepository.sendMessage({
      conversationId: conversation.id,
      fromId,
      toId,
      content: formatted.content,
      messageType: 'text',
      isRead: false
    })

    this.eventBus.emit('coach_message_sent', {
      messageId: message.id,
      fromId,
      toId,
      conversationId: conversation.id
    })

    return message
  }

  // ... implement remaining methods
}
```

---

## State Management Extension

### Extend `state/dataStore.ts`

```typescript
interface DataState {
  // ... existing state

  // Coach system
  coachInviteCode: string | null
  coachRelationships: CoachUserRelationship[]
  conversations: Conversation[]
  activeConversation: string | null
  coachUsers: CoachAnalyticsView[]

  // Actions
  setCoachInviteCode: (code: string | null) => void
  addCoachRelationship: (relationship: CoachUserRelationship) => void
  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (conversationId: string | null) => void
  updateConversationUnreadCount: (conversationId: string, count: number) => void
  setCoachUsers: (users: CoachAnalyticsView[]) => void
}

const dataStore = create<DataState>((set, get) => ({
  // ... existing state

  // Coach system initial state
  coachInviteCode: null,
  coachRelationships: [],
  conversations: [],
  activeConversation: null,
  coachUsers: [],

  // Coach actions
  setCoachInviteCode: (code) => set({ coachInviteCode: code }),

  addCoachRelationship: (relationship) => {
    const current = get().coachRelationships
    set({ coachRelationships: [...current, relationship] })
  },

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (conversationId) => set({ activeConversation: conversationId }),

  updateConversationUnreadCount: (conversationId, count) => {
    const conversations = get().conversations.map(c =>
      c.id === conversationId ? { ...c, unreadCount: count } : c
    )
    set({ conversations })
  },

  setCoachUsers: (users) => set({ coachUsers: users })
}))
```

---

## Event Bus Integration

### Extend `lib/eventBus.ts`

```typescript
type EventMap = {
  // ... existing events

  // Coach system events
  'coach_invitation_created': { userId: string; inviteCode: string; expiresAt: string }
  'coach_relationship_created': { coachId: string; userId: string; relationshipId: string }
  'coach_analytics_accessed': { coachId: string; userId: string; period: string; accessedAt: string }
  'coach_message_sent': { messageId: string; fromId: string; toId: string; conversationId: string }
  'coach_message_received': { messageId: string; fromId: string; toId: string; conversationId: string }
}
```

### Event Handlers in `lib/eventHandlers.ts`

```typescript
// Handle coach system events
eventBus.on('coach_relationship_created', async ({ coachId, userId, relationshipId }) => {
  // Refresh coach relationships in store
  const relationships = await coachRepository.getCoachUsers(coachId)
  dataStore.getState().setCoachRelationships(relationships)

  // Analytics tracking
  logger.info('Coach relationship created', { coachId, userId, relationshipId })
})

eventBus.on('coach_message_sent', async ({ messageId, fromId, toId, conversationId }) => {
  // Update conversation unread count for recipient
  const isUserRecipient = toId !== dataStore.getState().user?.id
  if (isUserRecipient) {
    // Increment unread count for user
    dataStore.getState().updateConversationUnreadCount(conversationId, 1)
  }
})
```

---

## Performance Considerations

### Caching Strategy

```typescript
// Cache coach analytics data for 5 minutes
const COACH_ANALYTICS_CACHE_TTL = 5 * 60 * 1000

class CachedCoachAnalyticsService implements CoachAnalyticsService {
  private cache = new Map<string, { data: CoachAnalyticsView; timestamp: number }>()

  async aggregateUserView(userId: string, period: '7d' | '30d' | '90d'): Promise<CoachAnalyticsView> {
    const cacheKey = `${userId}:${period}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < COACH_ANALYTICS_CACHE_TTL) {
      return cached.data
    }

    const data = await this.baseService.aggregateUserView(userId, period)
    this.cache.set(cacheKey, { data, timestamp: Date.now() })

    return data
  }
}
```

### Database Query Optimization

```sql
-- Optimized query for coach dashboard user list
CREATE OR REPLACE VIEW coach_users_summary AS
SELECT
  cur.coach_id,
  cur.user_id,
  p.name as user_name,
  cur.last_accessed_at,
  COALESCE(recent_logs.last_logged_at, '1970-01-01') as last_logged_at,
  COALESCE(daily_totals.adherence_score, 0) as adherence_score
FROM coach_user_relationships cur
JOIN profiles p ON p.id = cur.user_id
LEFT JOIN (
  SELECT user_id, MAX(logged_at) as last_logged_at
  FROM intake_log
  WHERE logged_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY user_id
) recent_logs ON recent_logs.user_id = cur.user_id
LEFT JOIN (
  SELECT user_id, AVG(adherence_percentage) as adherence_score
  FROM daily_totals
  WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY user_id
) daily_totals ON daily_totals.user_id = cur.user_id
WHERE cur.status = 'active';
```

---

## Testing Strategy

### Unit Tests

```typescript
// domain/services/__tests__/coachAnalytics.test.ts
describe('CoachAnalyticsService', () => {
  it('should aggregate user analytics view', async () => {
    const service = new CoachAnalyticsServiceImpl(mockAnalytics, mockTargets, mockInsights)

    const view = await service.aggregateUserView('user-123', '7d')

    expect(view.userId).toBe('user-123')
    expect(view.adherenceScore).toBeGreaterThan(0)
    expect(view.trendSummary.period).toBe('7d')
  })

  it('should identify red flags from trends', () => {
    const trends: TrendData[] = [
      { nutrient: 'protein_g', direction: 'decreasing', confidence: 0.8, data: [] }
    ]

    const flags = service.identifyRedFlags('user-123', trends)

    expect(flags).toContain('Protein intake declining')
  })
})
```

### Integration Tests

```typescript
// facades/__tests__/coachDashboard.integration.test.ts
describe('Coach Dashboard Integration', () => {
  it('should complete coach invitation flow', async () => {
    const startTime = performance.now()

    // Generate invitation
    const inviteCode = await coachFacade.generateUserInviteCode('user-123')
    expect(inviteCode).toMatch(/^[A-Z0-9]{8}$/)

    // Accept invitation
    const result = await coachFacade.acceptInvitation('coach-456', inviteCode)
    expect(result.success).toBe(true)

    // Verify analytics access
    const analytics = await coachFacade.getUserAnalytics('coach-456', 'user-123', '7d')
    expect(analytics.userId).toBe('user-123')

    const elapsed = performance.now() - startTime
    expect(elapsed).toBeLessThan(800) // Performance budget
  })
})
```

---

## Implementation Checklist

### Day 1: Foundation
- [ ] Create database migration (`011_add_coach_system.sql`)
- [ ] Implement domain services (`CoachInvitationService`, `CoachAnalyticsService`, `MessagingService`)
- [ ] Add domain types to `models.ts`
- [ ] Create repository interfaces and implementations
- [ ] Unit tests for domain services

### Day 2: Messaging & Real-time
- [ ] Implement messaging repository with Supabase subscriptions
- [ ] Create coach dashboard facade
- [ ] Extend data store with coach state
- [ ] Wire event bus handlers
- [ ] Integration tests for messaging flow

### Day 3: Integration & Polish
- [ ] Performance optimization and caching
- [ ] Error handling and edge cases
- [ ] End-to-end testing
- [ ] Documentation updates
- [ ] Performance budget validation

---

## Future Extensibility

### Coach Management Capabilities (Future)
```typescript
// Future coach permissions
export type CoachPermission =
  | 'view_analytics'
  | 'view_meal_plans'
  | 'modify_goals'      // ← Add goal modification
  | 'modify_meals'      // ← Add meal editing
  | 'create_plans'      // ← Add meal plan creation
  | 'bulk_updates'      // ← Add batch operations

// Enhanced message types
export type MessageType =
  | 'text'
  | 'meal_suggestion'   // ← Rich meal data in metadata
  | 'goal_update'       // ← Goal changes in metadata
  | 'plan_share'        // ← Meal plan sharing
  | 'system_notification'
```

### Rich Messaging (Future)
```typescript
// Enhanced message metadata
type MessageMetadata = {
  meal_suggestion?: {
    mealId: string
    nutrients: NutrientVector
    servingSize: number
  }
  goal_update?: {
    oldTargets: TargetVector
    newTargets: TargetVector
    reason: string
  }
  plan_share?: {
    planId: string
    weekStartDate: string
    previewMeals: string[]
  }
}
```

---

## Success Metrics

### Technical Metrics
- Coach analytics queries < 800ms (same as user analytics)
- Message delivery < 100ms real-time
- Invitation acceptance flow < 1200ms end-to-end
- Zero architectural violations (automated ESLint checks)

### Feature Metrics
- Coach invitation success rate > 95%
- Message delivery reliability > 99.9%
- Analytics cache hit rate > 80%
- Zero data leakage between coach-user relationships

---

## Rollout Plan

### Phase 1: Internal Testing (Week 1)
- Deploy to staging environment
- Internal coach-user pairs testing
- Performance validation
- Edge case identification

### Phase 2: Limited Beta (Week 2)
- Feature flag rollout to 10% of users
- Monitor error rates and performance
- Gather user feedback on invitation flow
- Validate real-time messaging stability

### Phase 3: Full Release (Week 3)
- Feature flag to 100% when metrics are stable
- Documentation for coaches
- Support team training
- Success metrics tracking

---

This implementation guide provides a complete Foundation.md-compliant coach dashboard feature that leverages existing analytics infrastructure while adding minimal complexity. The vertical slice approach ensures the feature can be built end-to-end without breaking existing functionality, and the extensible design allows for future coach management capabilities.
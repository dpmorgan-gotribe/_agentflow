# Step 63: Expo Mobile

> **Checkpoint:** CP12 - Mobile/Desktop
> **Previous Step:** 62-OBSERVABILITY.md (CP11)
> **Next Step:** 64-TAURI-DESKTOP.md
> **Architecture Reference:** `ARCHITECTURE.md` - Mobile Application

---

## Overview

**Expo Mobile** builds the React Native mobile application for iOS and Android using Expo, enabling task management and agent monitoring on mobile devices.

---

## Deliverables

1. `apps/mobile/` - Expo application
2. `apps/mobile/app/` - App router screens
3. `apps/mobile/components/` - Mobile components
4. `apps/mobile/hooks/` - Mobile-specific hooks

---

## 1. Application Structure

```
apps/mobile/
├── app.json
├── babel.config.js
├── metro.config.js
├── package.json
├── app/
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Home screen
│   ├── (tabs)/
│   │   ├── _layout.tsx    # Tab navigator
│   │   ├── index.tsx      # Dashboard tab
│   │   ├── tasks.tsx      # Tasks tab
│   │   └── settings.tsx   # Settings tab
│   └── task/
│       └── [id].tsx       # Task detail
├── components/
│   ├── TaskCard.tsx
│   ├── AgentBadge.tsx
│   └── PromptInput.tsx
└── hooks/
    ├── useApi.ts
    └── usePushNotifications.ts
```

---

## 2. Tab Navigator

```typescript
// apps/mobile/app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';
import { Home, ListTodo, Settings } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366f1',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <ListTodo color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

---

## 3. Dashboard Screen

```typescript
// apps/mobile/app/(tabs)/index.tsx

import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTasks, useProjects } from '../../hooks/useApi';
import { TaskCard } from '../../components/TaskCard';
import { PromptInput } from '../../components/PromptInput';

export default function DashboardScreen() {
  const { data: tasks, refetch, isLoading } = useTasks();

  const activeTasks = tasks?.filter(t => t.state === 'running') || [];
  const recentTasks = tasks?.slice(0, 5) || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        contentContainerStyle={{ padding: 16 }}
      >
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
          Dashboard
        </Text>

        {/* Quick Prompt */}
        <PromptInput />

        {/* Active Tasks */}
        {activeTasks.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              Active Tasks
            </Text>
            {activeTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </View>
        )}

        {/* Recent Tasks */}
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
            Recent Tasks
          </Text>
          {recentTasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

---

## 4. Task Card Component

```typescript
// apps/mobile/components/TaskCard.tsx

import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { AgentBadge } from './AgentBadge';

interface TaskCardProps {
  task: {
    id: string;
    prompt: string;
    state: string;
    currentAgent?: string;
    createdAt: string;
  };
}

const stateColors: Record<string, string> = {
  pending: '#9ca3af',
  running: '#3b82f6',
  awaiting_approval: '#f59e0b',
  completed: '#10b981',
  failed: '#ef4444',
};

export function TaskCard({ task }: TaskCardProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/task/${task.id}`)}
      style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: stateColors[task.state],
            marginRight: 8,
          }}
        />
        <Text style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>
          {task.state.replace('_', ' ')}
        </Text>
      </View>

      <Text style={{ fontSize: 16, fontWeight: '500', marginBottom: 8 }} numberOfLines={2}>
        {task.prompt}
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {task.currentAgent && <AgentBadge agent={task.currentAgent} />}
        <Text style={{ fontSize: 12, color: '#9ca3af' }}>
          {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
        </Text>
      </View>
    </Pressable>
  );
}
```

---

## 5. Push Notifications

```typescript
// apps/mobile/hooks/usePushNotifications.ts

import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token || null);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(
      notification => {
        console.log('Notification received:', notification);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      response => {
        console.log('Notification response:', response);
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return { expoPushToken };
}

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return undefined;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return undefined;
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}
```

---

## Validation Checklist

```
□ Expo Mobile (Step 63)
  □ App builds for iOS
  □ App builds for Android
  □ Navigation works
  □ API connection works
  □ Push notifications work
  □ Offline mode works
  □ Tests pass
```

---

## Next Step

Proceed to **64-TAURI-DESKTOP.md** to build the desktop application.

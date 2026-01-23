/**
 * Environment Switcher Component
 *
 * Allows users to manage and switch between multiple coordinator environments
 */

import { useEffect, useState } from 'react';
import type { Environment } from '../../config/environments';
import {
  addEnvironment,
  checkEnvironmentHealth,
  createDefaultEnvironment,
  deleteEnvironment,
  getActiveEnvironmentId,
  getStoredEnvironments,
  setActiveEnvironmentId,
  updateEnvironment,
  updateLastConnected,
} from '../../config/environments';
import { Box, Button, HStack, Input, Pressable, Text, VStack } from '../atoms';
import { Badge } from '../atoms/Badge';

interface EnvironmentItemProps {
  environment: Environment;
  isActive: boolean;
  isOnline: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function EnvironmentItem({
  environment,
  isActive,
  isOnline,
  onSelect,
  onEdit,
  onDelete,
}: EnvironmentItemProps) {
  return (
    <Pressable onPress={onSelect}>
      <Box
        style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: isActive ? '#f0f9ff' : '#f8f9fa',
          borderWidth: isActive ? 2 : 1,
          borderColor: isActive ? '#3b82f6' : '#e5e7eb',
          marginBottom: 8,
        }}
      >
        <HStack gap="md" style={{ alignItems: 'center' }}>
          <VStack style={{ flex: 1 }}>
            <HStack gap="sm" style={{ alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', fontSize: 14 }}>
                {environment.name}
              </Text>
              <Badge variant={isOnline ? 'success' : 'default'}>
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </HStack>
            <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {new URL(environment.coordinatorUrl).host}
            </Text>
            {environment.lastConnected && (
              <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                Last connected:{' '}
                {new Date(environment.lastConnected).toLocaleString()}
              </Text>
            )}
          </VStack>
          <HStack gap="xs">
            <Pressable onPress={onEdit}>
              <Text style={{ color: '#3b82f6', fontSize: 12 }}>Edit</Text>
            </Pressable>
            {!isActive && (
              <Pressable onPress={onDelete}>
                <Text style={{ color: '#ef4444', fontSize: 12 }}>Delete</Text>
              </Pressable>
            )}
          </HStack>
        </HStack>
      </Box>
    </Pressable>
  );
}

interface AddEnvironmentFormProps {
  onAdd: (env: Omit<Environment, 'id'>) => void;
  onCancel: () => void;
  editingEnv?: Environment;
}

function AddEnvironmentForm({
  onAdd,
  onCancel,
  editingEnv,
}: AddEnvironmentFormProps) {
  const [name, setName] = useState(editingEnv?.name ?? '');
  const [port, setPort] = useState(
    editingEnv ? new URL(editingEnv.coordinatorUrl).port : '41957'
  );

  const handleSubmit = () => {
    if (!name.trim() || !port.trim()) return;

    const portNum = parseInt(port, 10);
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) return;

    onAdd({
      name: name.trim(),
      coordinatorUrl: `https://coordinator.local.han.guru:${portNum}`,
      wsUrl: `wss://coordinator.local.han.guru:${portNum}`,
    });
  };

  return (
    <Box
      style={{
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      <VStack gap="md">
        <Text style={{ fontWeight: '600', fontSize: 14 }}>
          {editingEnv ? 'Edit Environment' : 'Add Environment'}
        </Text>

        <VStack gap="xs">
          <Text style={{ fontSize: 12, color: '#6b7280' }}>Name</Text>
          <Input
            value={name}
            onChange={setName}
            placeholder="My Environment"
            style={{ backgroundColor: '#ffffff' }}
          />
        </VStack>

        <VStack gap="xs">
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            Coordinator Port
          </Text>
          <Input
            value={port}
            onChange={setPort}
            placeholder="41957"
            type="number"
            style={{ backgroundColor: '#ffffff' }}
          />
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>
            Port from ~/.claude/han.yml
          </Text>
        </VStack>

        <HStack gap="sm" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit}>
            {editingEnv ? 'Save' : 'Add'}
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}

export function EnvironmentSwitcher() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Environment | undefined>();

  // Load environments and active ID
  useEffect(() => {
    const envs = getStoredEnvironments();
    setEnvironments(envs);
    setActiveId(getActiveEnvironmentId());

    // Check health of all environments
    Promise.all(
      envs.map(async (env) => {
        const isOnline = await checkEnvironmentHealth(env);
        return [env.id, isOnline] as const;
      })
    ).then((results) => {
      const status = Object.fromEntries(results);
      setOnlineStatus(status);
    });
  }, []);

  const handleSelectEnvironment = (id: string) => {
    setActiveId(id);
    setActiveEnvironmentId(id);
    updateLastConnected(id);

    // Reload page to apply new environment
    window.location.reload();
  };

  const handleAddEnvironment = (env: Omit<Environment, 'id'>) => {
    if (editingEnv) {
      // Update existing
      updateEnvironment(editingEnv.id, env);
      const updated = getStoredEnvironments();
      setEnvironments(updated);
      setEditingEnv(undefined);
    } else {
      // Add new
      const newEnv = addEnvironment(env);
      setEnvironments([...environments, newEnv]);
    }
    setShowAddForm(false);
  };

  const handleDeleteEnvironment = (id: string) => {
    if (confirm('Delete this environment?')) {
      deleteEnvironment(id);
      setEnvironments(environments.filter((env) => env.id !== id));
    }
  };

  const handleEditEnvironment = (env: Environment) => {
    setEditingEnv(env);
    setShowAddForm(true);
  };

  return (
    <Box style={{ padding: 16, minWidth: 400 }}>
      <VStack gap="md">
        <HStack
          gap="md"
          style={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700' }}>Environments</Text>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingEnv(undefined);
              setShowAddForm(!showAddForm);
            }}
          >
            {showAddForm ? 'Cancel' : 'Add'}
          </Button>
        </HStack>

        {showAddForm && (
          <AddEnvironmentForm
            onAdd={handleAddEnvironment}
            onCancel={() => {
              setShowAddForm(false);
              setEditingEnv(undefined);
            }}
            editingEnv={editingEnv}
          />
        )}

        {environments.length === 0 ? (
          <Box
            style={{
              padding: 24,
              textAlign: 'center',
              backgroundColor: '#f8f9fa',
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#6b7280', marginBottom: 12 }}>
              No environments configured
            </Text>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const defaultEnv = createDefaultEnvironment();
                const newEnv = addEnvironment(defaultEnv);
                setEnvironments([newEnv]);
                setActiveId(newEnv.id);
                setActiveEnvironmentId(newEnv.id);
              }}
            >
              Add Default Environment
            </Button>
          </Box>
        ) : (
          <VStack gap="xs">
            {environments.map((env) => (
              <EnvironmentItem
                key={env.id}
                environment={env}
                isActive={env.id === activeId}
                isOnline={onlineStatus[env.id] ?? false}
                onSelect={() => handleSelectEnvironment(env.id)}
                onEdit={() => handleEditEnvironment(env)}
                onDelete={() => handleDeleteEnvironment(env.id)}
              />
            ))}
          </VStack>
        )}

        <Box
          style={{
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
          }}
        >
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>
            Switching environments will reload the page
          </Text>
        </Box>
      </VStack>
    </Box>
  );
}

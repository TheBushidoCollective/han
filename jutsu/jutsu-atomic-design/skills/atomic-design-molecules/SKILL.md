---
name: atomic-design-molecules
description: Use when composing atoms into molecule components like form fields, search bars, and card headers. Molecules are functional groups of atoms.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Atomic Design: Molecules

Master the creation of molecule components - functional groups of atoms that work together as a unit. Molecules combine multiple atoms to create more complex, purposeful UI elements.

## What Are Molecules?

Molecules are the first level of composition in Atomic Design. They are:

- **Composed of atoms only**: Never include other molecules
- **Single purpose**: Do one thing well
- **Functional units**: Atoms working together for a specific task
- **Reusable**: Used across different organisms and contexts
- **Minimally stateful**: May have limited internal state for UI concerns

## Common Molecule Types

### Form Molecules

- Form fields (label + input + error)
- Search forms (input + button)
- Toggle groups (label + toggle)
- Date pickers (input + calendar trigger)
- File uploaders (dropzone + button)

### Navigation Molecules

- Nav items (icon + text + indicator)
- Breadcrumb items (link + separator)
- Pagination controls (buttons + page indicator)
- Tab items (icon + label)

### Display Molecules

- Media objects (avatar + text)
- Card headers (title + subtitle + action)
- List items (checkbox + content + actions)
- Stat displays (label + value + trend)

### Action Molecules

- Button groups (multiple buttons)
- Dropdown triggers (button + icon)
- Icon buttons (icon + tooltip)
- Action menus (button + menu items)

## FormField Molecule Example

### Complete Implementation

```typescript
// molecules/FormField/FormField.tsx
import React from 'react';
import { Label } from '@/components/atoms/Label';
import { Input, type InputProps } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Typography';
import styles from './FormField.module.css';

export interface FormFieldProps extends InputProps {
  /** Field label */
  label: string;
  /** Unique field identifier */
  name: string;
  /** Help text below input */
  helpText?: string;
  /** Error message */
  error?: string;
  /** Required field indicator */
  required?: boolean;
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      label,
      name,
      helpText,
      error,
      required = false,
      id,
      className,
      ...inputProps
    },
    ref
  ) => {
    const fieldId = id || `field-${name}`;
    const helpTextId = helpText ? `${fieldId}-help` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;

    const describedBy = [helpTextId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={`${styles.field} ${className || ''}`}>
        <Label htmlFor={fieldId} required={required} disabled={inputProps.disabled}>
          {label}
        </Label>

        <Input
          ref={ref}
          id={fieldId}
          name={name}
          hasError={!!error}
          aria-describedby={describedBy}
          aria-required={required}
          {...inputProps}
        />

        {helpText && !error && (
          <Text id={helpTextId} size="sm" color="muted" className={styles.helpText}>
            {helpText}
          </Text>
        )}

        {error && (
          <Text id={errorId} size="sm" color="danger" className={styles.error} role="alert">
            {error}
          </Text>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
```

```css
/* molecules/FormField/FormField.module.css */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.helpText {
  margin-top: 2px;
}

.error {
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}
```

## SearchForm Molecule Example

```typescript
// molecules/SearchForm/SearchForm.tsx
import React, { useState, useCallback } from 'react';
import { Input } from '@/components/atoms/Input';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import styles from './SearchForm.module.css';

export interface SearchFormProps {
  /** Placeholder text */
  placeholder?: string;
  /** Initial search value */
  defaultValue?: string;
  /** Submit handler */
  onSubmit: (query: string) => void;
  /** Change handler for live search */
  onChange?: (query: string) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show clear button */
  clearable?: boolean;
}

export const SearchForm: React.FC<SearchFormProps> = ({
  placeholder = 'Search...',
  defaultValue = '',
  onSubmit,
  onChange,
  isLoading = false,
  size = 'md',
  clearable = true,
}) => {
  const [query, setQuery] = useState(defaultValue);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      onChange?.(value);
    },
    [onChange]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(query.trim());
    },
    [onSubmit, query]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    onChange?.('');
  }, [onChange]);

  return (
    <form className={styles.form} onSubmit={handleSubmit} role="search">
      <Input
        type="search"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        size={size}
        leftAddon={<Icon name="search" size="sm" />}
        rightAddon={
          clearable && query ? (
            <button
              type="button"
              onClick={handleClear}
              className={styles.clearButton}
              aria-label="Clear search"
            >
              <Icon name="x" size="sm" />
            </button>
          ) : undefined
        }
        aria-label="Search query"
      />
      <Button type="submit" size={size} isLoading={isLoading}>
        Search
      </Button>
    </form>
  );
};

SearchForm.displayName = 'SearchForm';
```

```css
/* molecules/SearchForm/SearchForm.module.css */
.form {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.clearButton {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--color-neutral-500);
  transition: color 150ms;
}

.clearButton:hover {
  color: var(--color-neutral-700);
}
```

## MediaObject Molecule Example

```typescript
// molecules/MediaObject/MediaObject.tsx
import React from 'react';
import { Avatar, type AvatarProps } from '@/components/atoms/Avatar';
import { Text, Heading } from '@/components/atoms/Typography';
import styles from './MediaObject.module.css';

export interface MediaObjectProps {
  /** Avatar image source */
  avatarSrc?: string;
  /** Avatar alt text */
  avatarAlt: string;
  /** Avatar initials fallback */
  avatarInitials?: string;
  /** Avatar size */
  avatarSize?: AvatarProps['size'];
  /** Primary text/title */
  title: React.ReactNode;
  /** Secondary text/subtitle */
  subtitle?: React.ReactNode;
  /** Additional metadata */
  meta?: React.ReactNode;
  /** Right-aligned action element */
  action?: React.ReactNode;
  /** Alignment of content */
  align?: 'top' | 'center' | 'bottom';
  /** Additional class name */
  className?: string;
}

export const MediaObject: React.FC<MediaObjectProps> = ({
  avatarSrc,
  avatarAlt,
  avatarInitials,
  avatarSize = 'md',
  title,
  subtitle,
  meta,
  action,
  align = 'center',
  className,
}) => {
  const classNames = [styles.mediaObject, styles[`align-${align}`], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames}>
      <Avatar
        src={avatarSrc}
        alt={avatarAlt}
        initials={avatarInitials}
        size={avatarSize}
      />

      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        {subtitle && (
          <Text size="sm" color="muted" className={styles.subtitle}>
            {subtitle}
          </Text>
        )}
        {meta && (
          <Text size="xs" color="muted" className={styles.meta}>
            {meta}
          </Text>
        )}
      </div>

      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
};

MediaObject.displayName = 'MediaObject';
```

## NavItem Molecule Example

```typescript
// molecules/NavItem/NavItem.tsx
import React from 'react';
import { Icon } from '@/components/atoms/Icon';
import { Badge } from '@/components/atoms/Badge';
import styles from './NavItem.module.css';

export interface NavItemProps {
  /** Navigation icon */
  icon?: string;
  /** Item label */
  label: string;
  /** Link destination */
  href: string;
  /** Active state */
  isActive?: boolean;
  /** Badge count */
  badge?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
}

export const NavItem: React.FC<NavItemProps> = ({
  icon,
  label,
  href,
  isActive = false,
  badge,
  disabled = false,
  onClick,
}) => {
  const classNames = [
    styles.navItem,
    isActive && styles.active,
    disabled && styles.disabled,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <a
      href={href}
      className={classNames}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={disabled}
    >
      {icon && <Icon name={icon} size="sm" className={styles.icon} />}
      <span className={styles.label}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="primary" size="sm" className={styles.badge}>
          {badge > 99 ? '99+' : badge}
        </Badge>
      )}
    </a>
  );
};

NavItem.displayName = 'NavItem';
```

## CardHeader Molecule Example

```typescript
// molecules/CardHeader/CardHeader.tsx
import React from 'react';
import { Heading, Text } from '@/components/atoms/Typography';
import { Icon } from '@/components/atoms/Icon';
import { Button } from '@/components/atoms/Button';
import styles from './CardHeader.module.css';

export interface CardHeaderProps {
  /** Card title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Title icon */
  icon?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action button click handler */
  onAction?: () => void;
  /** Additional class name */
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div className={`${styles.header} ${className || ''}`}>
      <div className={styles.left}>
        {icon && <Icon name={icon} size="md" className={styles.icon} />}
        <div className={styles.titles}>
          <Heading level={3} className={styles.title}>
            {title}
          </Heading>
          {subtitle && (
            <Text size="sm" color="muted">
              {subtitle}
            </Text>
          )}
        </div>
      </div>

      {actionLabel && onAction && (
        <Button variant="tertiary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

CardHeader.displayName = 'CardHeader';
```

## ListItem Molecule Example

```typescript
// molecules/ListItem/ListItem.tsx
import React from 'react';
import { Checkbox } from '@/components/atoms/Checkbox';
import { Text } from '@/components/atoms/Typography';
import { Icon } from '@/components/atoms/Icon';
import styles from './ListItem.module.css';

export interface ListItemProps {
  /** Item ID for selection */
  id: string;
  /** Primary content */
  primary: React.ReactNode;
  /** Secondary content */
  secondary?: React.ReactNode;
  /** Left icon */
  icon?: string;
  /** Whether item is selectable */
  selectable?: boolean;
  /** Selection state */
  selected?: boolean;
  /** Selection change handler */
  onSelect?: (id: string, selected: boolean) => void;
  /** Right-aligned action buttons */
  actions?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
}

export const ListItem: React.FC<ListItemProps> = ({
  id,
  primary,
  secondary,
  icon,
  selectable = false,
  selected = false,
  onSelect,
  actions,
  onClick,
}) => {
  const classNames = [
    styles.listItem,
    onClick && styles.clickable,
    selected && styles.selected,
  ]
    .filter(Boolean)
    .join(' ');

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect?.(id, e.target.checked);
  };

  return (
    <div className={classNames} onClick={onClick} role={onClick ? 'button' : undefined}>
      {selectable && (
        <Checkbox
          checked={selected}
          onChange={handleCheckboxChange}
          aria-label={`Select ${primary}`}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {icon && <Icon name={icon} size="md" className={styles.icon} />}

      <div className={styles.content}>
        <div className={styles.primary}>{primary}</div>
        {secondary && (
          <Text size="sm" color="muted" className={styles.secondary}>
            {secondary}
          </Text>
        )}
      </div>

      {actions && (
        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
};

ListItem.displayName = 'ListItem';
```

## ButtonGroup Molecule Example

```typescript
// molecules/ButtonGroup/ButtonGroup.tsx
import React from 'react';
import { Button, type ButtonProps } from '@/components/atoms/Button';
import styles from './ButtonGroup.module.css';

export interface ButtonGroupItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

export interface ButtonGroupProps {
  /** Button items */
  items: ButtonGroupItem[];
  /** Selected item ID(s) */
  value?: string | string[];
  /** Selection change handler */
  onChange?: (value: string | string[]) => void;
  /** Allow multiple selection */
  multiple?: boolean;
  /** Size variant */
  size?: ButtonProps['size'];
  /** Disabled state */
  disabled?: boolean;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  items,
  value = [],
  onChange,
  multiple = false,
  size = 'md',
  disabled = false,
}) => {
  const selectedIds = Array.isArray(value) ? value : [value].filter(Boolean);

  const handleClick = (itemId: string) => {
    if (!onChange) return;

    if (multiple) {
      const newValue = selectedIds.includes(itemId)
        ? selectedIds.filter((id) => id !== itemId)
        : [...selectedIds, itemId];
      onChange(newValue);
    } else {
      onChange(itemId);
    }
  };

  return (
    <div className={styles.group} role="group">
      {items.map((item) => {
        const isSelected = selectedIds.includes(item.id);

        return (
          <Button
            key={item.id}
            variant={isSelected ? 'primary' : 'secondary'}
            size={size}
            disabled={disabled || item.disabled}
            onClick={() => handleClick(item.id)}
            aria-pressed={isSelected}
            className={styles.button}
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
};

ButtonGroup.displayName = 'ButtonGroup';
```

## Stat Molecule Example

```typescript
// molecules/Stat/Stat.tsx
import React from 'react';
import { Text, Heading } from '@/components/atoms/Typography';
import { Icon } from '@/components/atoms/Icon';
import styles from './Stat.module.css';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface StatProps {
  /** Stat label */
  label: string;
  /** Stat value */
  value: string | number;
  /** Previous value for comparison */
  previousValue?: string | number;
  /** Trend direction */
  trend?: TrendDirection;
  /** Trend percentage */
  trendValue?: string;
  /** Stat icon */
  icon?: string;
  /** Help text */
  helpText?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  trend,
  trendValue,
  icon,
  helpText,
}) => {
  const getTrendColor = (direction?: TrendDirection) => {
    switch (direction) {
      case 'up':
        return 'success';
      case 'down':
        return 'danger';
      default:
        return 'muted';
    }
  };

  const getTrendIcon = (direction?: TrendDirection) => {
    switch (direction) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'minus';
    }
  };

  return (
    <div className={styles.stat}>
      <div className={styles.header}>
        {icon && <Icon name={icon} size="sm" className={styles.icon} />}
        <Text size="sm" color="muted">
          {label}
        </Text>
      </div>

      <div className={styles.value}>
        <Heading level={2}>{value}</Heading>
      </div>

      {(trend || trendValue) && (
        <div className={styles.trend}>
          {trend && (
            <Icon
              name={getTrendIcon(trend)}
              size="xs"
              color={`var(--color-${getTrendColor(trend)}-500)`}
            />
          )}
          {trendValue && (
            <Text size="sm" color={getTrendColor(trend)}>
              {trendValue}
            </Text>
          )}
        </div>
      )}

      {helpText && (
        <Text size="xs" color="muted" className={styles.helpText}>
          {helpText}
        </Text>
      )}
    </div>
  );
};

Stat.displayName = 'Stat';
```

## Best Practices

### 1. Keep Molecules Focused

```typescript
// GOOD: Single, clear purpose
const SearchForm = () => (
  <form>
    <Input placeholder="Search..." />
    <Button>Search</Button>
  </form>
);

// BAD: Doing too much
const SearchWithFiltersAndResults = () => (
  <div>
    <Input />
    <Button>Search</Button>
    <FilterDropdown />       {/* Should be separate molecule */}
    <ResultsList />          {/* Should be organism */}
    <Pagination />           {/* Should be separate molecule */}
  </div>
);
```

### 2. Only Import from Atoms

```typescript
// GOOD: Only uses atoms
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Icon } from '@/components/atoms/Icon';

// BAD: Importing from other molecules
import { FormField } from '@/components/molecules/FormField'; // Wrong level!
import { Button } from '@/components/atoms/Button';
```

### 3. Compose Props Carefully

```typescript
// GOOD: Clear prop forwarding
interface SearchFormProps {
  onSubmit: (query: string) => void;
  inputProps?: Partial<InputProps>;
  buttonProps?: Partial<ButtonProps>;
}

// BAD: Confusing prop naming
interface SearchFormProps {
  inputPlaceholder?: string;
  inputDisabled?: boolean;
  inputSize?: string;
  buttonVariant?: string;
  buttonDisabled?: boolean;
  // ... endless prop forwarding
}
```

### 4. Manage Internal State Minimally

```typescript
// GOOD: Minimal UI state
const SearchForm = ({ onSubmit }) => {
  const [query, setQuery] = useState('');

  return (
    <form onSubmit={() => onSubmit(query)}>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} />
      <Button type="submit">Search</Button>
    </form>
  );
};

// BAD: Too much internal state
const SearchForm = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);  // Should be in parent
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchResults(query).then(setResults);  // Business logic in molecule!
  }, [query]);
};
```

## Anti-Patterns to Avoid

### 1. Molecules Containing Molecules

```typescript
// BAD: Molecule importing another molecule
// molecules/ComplexForm/ComplexForm.tsx
import { FormField } from '../FormField';  // Wrong!
import { SearchForm } from '../SearchForm'; // Wrong!

// GOOD: Keep at atom level, or promote to organism
// organisms/ComplexForm/ComplexForm.tsx
import { FormField } from '@/components/molecules/FormField';
import { SearchForm } from '@/components/molecules/SearchForm';
```

### 2. Business Logic in Molecules

```typescript
// BAD: API calls in molecule
const SearchForm = ({ apiEndpoint }) => {
  const handleSubmit = async (query) => {
    const results = await fetch(`${apiEndpoint}?q=${query}`);
    // Processing results here...
  };
};

// GOOD: Delegate to parent
const SearchForm = ({ onSubmit }) => {
  const handleSubmit = (query) => {
    onSubmit(query); // Parent handles API logic
  };
};
```

### 3. Over-Abstraction

```typescript
// BAD: Unnecessary molecule for single atom
const IconWrapper = ({ icon }) => <Icon name={icon} />;

// GOOD: Just use the atom directly
<Icon name="search" />
```

## When to Use This Skill

- Combining atoms for specific functionality
- Creating reusable form components
- Building navigation elements
- Creating card and list components
- Establishing patterns for common UI combinations

## Related Skills

- `atomic-design-fundamentals` - Core methodology overview
- `atomic-design-atoms` - Creating atomic components
- `atomic-design-organisms` - Building complex organisms

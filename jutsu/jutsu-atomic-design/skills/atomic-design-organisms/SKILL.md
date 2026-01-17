---
name: atomic-design-organisms
description: Use when building complex organisms from molecules and atoms like headers, footers, product cards, and sidebars. Organisms are distinct UI sections.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Atomic Design: Organisms

Master the creation of organisms - complex, distinct sections of an interface composed of molecules and atoms. Organisms represent standalone UI sections that could exist independently.

## What Are Organisms?

Organisms are relatively complex UI components that form distinct sections of an interface. They are:

- **Composed of molecules and atoms**: May include both levels
- **Standalone sections**: Can exist independently on a page
- **Context-aware**: Often tied to specific business contexts
- **Stateful**: May manage significant internal state
- **Reusable**: Used across different templates and pages

## Common Organism Types

### Navigation Organisms

- Header (logo + navigation + user menu)
- Footer (links + social icons + legal)
- Sidebar (navigation + user info + actions)
- Breadcrumbs (full navigation path)

### Content Organisms

- Product cards (image + details + actions)
- Comment sections (comments + reply forms)
- Article previews (title + excerpt + meta)
- User profiles (avatar + bio + stats)

### Form Organisms

- Login forms (fields + actions + links)
- Registration forms (multi-step fields)
- Checkout forms (payment + shipping)
- Search with filters

### Data Display Organisms

- Data tables (header + rows + pagination)
- Dashboards (stats + charts + actions)
- Timelines (events + connectors)
- Galleries (images + navigation)

## Header Organism Example

### Complete Implementation

```typescript
// organisms/Header/Header.tsx
import React, { useState } from 'react';
import { Icon } from '@/components/atoms/Icon';
import { Button } from '@/components/atoms/Button';
import { Avatar } from '@/components/atoms/Avatar';
import { NavItem } from '@/components/molecules/NavItem';
import { SearchForm } from '@/components/molecules/SearchForm';
import styles from './Header.module.css';

export interface NavLink {
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface HeaderProps {
  /** Logo element or image */
  logo: React.ReactNode;
  /** Navigation links */
  navigation: NavLink[];
  /** Current active nav item */
  activeNavId?: string;
  /** Authenticated user */
  user?: User | null;
  /** Show search form */
  showSearch?: boolean;
  /** Search submit handler */
  onSearch?: (query: string) => void;
  /** Login click handler */
  onLogin?: () => void;
  /** Logout click handler */
  onLogout?: () => void;
  /** Profile click handler */
  onProfileClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  logo,
  navigation,
  activeNavId,
  user,
  showSearch = true,
  onSearch,
  onLogin,
  onLogout,
  onProfileClick,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Logo */}
        <div className={styles.logo}>{logo}</div>

        {/* Desktop Navigation */}
        <nav className={styles.nav} aria-label="Main navigation">
          <ul className={styles.navList}>
            {navigation.map((item) => (
              <li key={item.id}>
                <NavItem
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  badge={item.badge}
                  isActive={item.id === activeNavId}
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* Search */}
        {showSearch && onSearch && (
          <div className={styles.search}>
            <SearchForm
              onSubmit={onSearch}
              placeholder="Search..."
              size="sm"
            />
          </div>
        )}

        {/* User Actions */}
        <div className={styles.actions}>
          {user ? (
            <div className={styles.userMenu}>
              <button
                className={styles.userButton}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <Avatar
                  src={user.avatar}
                  alt={user.name}
                  initials={user.name.slice(0, 2).toUpperCase()}
                  size="sm"
                />
                <span className={styles.userName}>{user.name}</span>
                <Icon name="chevron-down" size="xs" />
              </button>

              {userMenuOpen && (
                <div className={styles.dropdown}>
                  <button onClick={onProfileClick}>
                    <Icon name="user" size="sm" />
                    Profile
                  </button>
                  <button onClick={onLogout}>
                    <Icon name="log-out" size="sm" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={onLogin}>
              Login
            </Button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className={styles.mobileToggle}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle menu"
        >
          <Icon name={mobileMenuOpen ? 'x' : 'menu'} size="md" />
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className={styles.mobileNav} aria-label="Mobile navigation">
          <ul>
            {navigation.map((item) => (
              <li key={item.id}>
                <NavItem
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  badge={item.badge}
                  isActive={item.id === activeNavId}
                  onClick={() => setMobileMenuOpen(false)}
                />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
};

Header.displayName = 'Header';
```

```css
/* organisms/Header/Header.module.css */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: var(--color-white);
  border-bottom: 1px solid var(--color-neutral-200);
}

.container {
  display: flex;
  align-items: center;
  gap: 24px;
  max-width: 1280px;
  margin: 0 auto;
  padding: 12px 24px;
}

.logo {
  flex-shrink: 0;
}

.nav {
  display: none;
  flex: 1;
}

@media (min-width: 768px) {
  .nav {
    display: block;
  }
}

.navList {
  display: flex;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.search {
  display: none;
  width: 280px;
}

@media (min-width: 1024px) {
  .search {
    display: block;
  }
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.userMenu {
  position: relative;
}

.userButton {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--color-neutral-200);
  border-radius: 6px;
  cursor: pointer;
}

.userName {
  display: none;
}

@media (min-width: 640px) {
  .userName {
    display: inline;
  }
}

.dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  min-width: 160px;
  background: var(--color-white);
  border: 1px solid var(--color-neutral-200);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.dropdown button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}

.dropdown button:hover {
  background-color: var(--color-neutral-50);
}

.mobileToggle {
  display: flex;
  padding: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
}

@media (min-width: 768px) {
  .mobileToggle {
    display: none;
  }
}

.mobileNav {
  border-top: 1px solid var(--color-neutral-200);
  padding: 16px;
}

.mobileNav ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}
```

## Footer Organism Example

```typescript
// organisms/Footer/Footer.tsx
import React from 'react';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Typography';
import styles from './Footer.module.css';

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface SocialLink {
  platform: string;
  href: string;
  icon: string;
}

export interface FooterProps {
  /** Footer logo */
  logo: React.ReactNode;
  /** Tagline or description */
  tagline?: string;
  /** Link sections */
  sections: FooterSection[];
  /** Social media links */
  socialLinks?: SocialLink[];
  /** Copyright text */
  copyright?: string;
  /** Legal links */
  legalLinks?: FooterLink[];
}

export const Footer: React.FC<FooterProps> = ({
  logo,
  tagline,
  sections,
  socialLinks = [],
  copyright,
  legalLinks = [],
}) => {
  const currentYear = new Date().getFullYear();
  const copyrightText = copyright || `${currentYear} Company. All rights reserved.`;

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.top}>
          {/* Brand Column */}
          <div className={styles.brand}>
            <div className={styles.logo}>{logo}</div>
            {tagline && (
              <Text color="muted" className={styles.tagline}>
                {tagline}
              </Text>
            )}
            {socialLinks.length > 0 && (
              <div className={styles.social}>
                {socialLinks.map((link) => (
                  <a
                    key={link.platform}
                    href={link.href}
                    className={styles.socialLink}
                    aria-label={`Follow us on ${link.platform}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name={link.icon} size="md" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Link Sections */}
          <div className={styles.sections}>
            {sections.map((section) => (
              <div key={section.title} className={styles.section}>
                <Text weight="semibold" className={styles.sectionTitle}>
                  {section.title}
                </Text>
                <ul className={styles.linkList}>
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} className={styles.link}>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottom}>
          <Text size="sm" color="muted">
            {copyrightText}
          </Text>
          {legalLinks.length > 0 && (
            <div className={styles.legalLinks}>
              {legalLinks.map((link, index) => (
                <React.Fragment key={link.href}>
                  {index > 0 && <span className={styles.separator}>|</span>}
                  <a href={link.href} className={styles.legalLink}>
                    {link.label}
                  </a>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};

Footer.displayName = 'Footer';
```

## ProductCard Organism Example

```typescript
// organisms/ProductCard/ProductCard.tsx
import React from 'react';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text, Heading } from '@/components/atoms/Typography';
import styles from './ProductCard.module.css';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  image: string;
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
  badge?: string;
}

export interface ProductCardProps {
  /** Product data */
  product: Product;
  /** Add to cart handler */
  onAddToCart?: (productId: string) => void;
  /** Quick view handler */
  onQuickView?: (productId: string) => void;
  /** Favorite toggle handler */
  onFavorite?: (productId: string) => void;
  /** Whether product is favorited */
  isFavorite?: boolean;
  /** Loading state for add to cart */
  isAddingToCart?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onQuickView,
  onFavorite,
  isFavorite = false,
  isAddingToCart = false,
}) => {
  const {
    id,
    name,
    description,
    price,
    originalPrice,
    currency = '$',
    image,
    rating,
    reviewCount,
    inStock = true,
    badge,
  } = product;

  const discount = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : null;

  const formatPrice = (value: number) => {
    return `${currency}${value.toFixed(2)}`;
  };

  return (
    <article className={styles.card}>
      {/* Image Section */}
      <div className={styles.imageContainer}>
        <img src={image} alt={name} className={styles.image} />

        {badge && (
          <Badge variant="primary" className={styles.badge}>
            {badge}
          </Badge>
        )}

        {discount && (
          <Badge variant="danger" className={styles.discountBadge}>
            -{discount}%
          </Badge>
        )}

        {/* Quick Actions Overlay */}
        <div className={styles.overlay}>
          {onFavorite && (
            <button
              className={`${styles.iconButton} ${isFavorite ? styles.favorited : ''}`}
              onClick={() => onFavorite(id)}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Icon name={isFavorite ? 'heart-filled' : 'heart'} size="sm" />
            </button>
          )}

          {onQuickView && (
            <button
              className={styles.iconButton}
              onClick={() => onQuickView(id)}
              aria-label="Quick view"
            >
              <Icon name="eye" size="sm" />
            </button>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className={styles.content}>
        <Heading level={4} className={styles.name}>
          <a href={`/products/${id}`}>{name}</a>
        </Heading>

        {description && (
          <Text size="sm" color="muted" className={styles.description} truncate>
            {description}
          </Text>
        )}

        {/* Rating */}
        {rating !== undefined && (
          <div className={styles.rating}>
            <div className={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                  key={star}
                  name={star <= Math.round(rating) ? 'star-filled' : 'star'}
                  size="xs"
                  className={star <= Math.round(rating) ? styles.starFilled : styles.starEmpty}
                />
              ))}
            </div>
            {reviewCount !== undefined && (
              <Text size="xs" color="muted">
                ({reviewCount})
              </Text>
            )}
          </div>
        )}

        {/* Price */}
        <div className={styles.priceContainer}>
          <Text weight="bold" className={styles.price}>
            {formatPrice(price)}
          </Text>
          {originalPrice && (
            <Text size="sm" color="muted" className={styles.originalPrice}>
              <s>{formatPrice(originalPrice)}</s>
            </Text>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {inStock ? (
            <Button
              fullWidth
              variant="primary"
              onClick={() => onAddToCart?.(id)}
              isLoading={isAddingToCart}
              leftIcon={<Icon name="shopping-cart" size="sm" />}
            >
              Add to Cart
            </Button>
          ) : (
            <Button fullWidth variant="secondary" disabled>
              Out of Stock
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};

ProductCard.displayName = 'ProductCard';
```

## CommentSection Organism Example

```typescript
// organisms/CommentSection/CommentSection.tsx
import React, { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading, Text } from '@/components/atoms/Typography';
import { MediaObject } from '@/components/molecules/MediaObject';
import { FormField } from '@/components/molecules/FormField';
import styles from './CommentSection.module.css';

export interface Comment {
  id: string;
  author: {
    name: string;
    avatar?: string;
  };
  content: string;
  createdAt: string;
  likes: number;
  replies?: Comment[];
}

export interface CommentSectionProps {
  /** Comments list */
  comments: Comment[];
  /** Total comment count */
  totalCount: number;
  /** Current user (for comment form) */
  currentUser?: { name: string; avatar?: string };
  /** Submit comment handler */
  onSubmit?: (content: string, parentId?: string) => void;
  /** Like comment handler */
  onLike?: (commentId: string) => void;
  /** Delete comment handler */
  onDelete?: (commentId: string) => void;
  /** Loading state */
  isLoading?: boolean;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  comments,
  totalCount,
  currentUser,
  onSubmit,
  onLike,
  onDelete,
  isLoading = false,
}) => {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && onSubmit) {
      onSubmit(newComment.trim());
      setNewComment('');
    }
  };

  const handleReply = (parentId: string) => {
    if (replyContent.trim() && onSubmit) {
      onSubmit(replyContent.trim(), parentId);
      setReplyContent('');
      setReplyingTo(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div
      key={comment.id}
      className={`${styles.comment} ${isReply ? styles.reply : ''}`}
    >
      <MediaObject
        avatarSrc={comment.author.avatar}
        avatarAlt={comment.author.name}
        avatarInitials={comment.author.name.slice(0, 2).toUpperCase()}
        avatarSize="sm"
        title={
          <Text weight="semibold" size="sm">
            {comment.author.name}
          </Text>
        }
        subtitle={formatDate(comment.createdAt)}
      />

      <div className={styles.commentContent}>
        <Text>{comment.content}</Text>

        <div className={styles.commentActions}>
          <button
            className={styles.actionButton}
            onClick={() => onLike?.(comment.id)}
          >
            Like {comment.likes > 0 && `(${comment.likes})`}
          </button>

          {!isReply && currentUser && (
            <button
              className={styles.actionButton}
              onClick={() => setReplyingTo(comment.id)}
            >
              Reply
            </button>
          )}

          {onDelete && (
            <button
              className={styles.actionButton}
              onClick={() => onDelete(comment.id)}
            >
              Delete
            </button>
          )}
        </div>

        {/* Reply Form */}
        {replyingTo === comment.id && (
          <div className={styles.replyForm}>
            <FormField
              name="reply"
              label=""
              placeholder="Write a reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
            />
            <div className={styles.replyActions}>
              <Button size="sm" onClick={() => handleReply(comment.id)}>
                Reply
              </Button>
              <Button
                size="sm"
                variant="tertiary"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Nested Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className={styles.replies}>
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className={styles.section} aria-label="Comments">
      <Heading level={3} className={styles.title}>
        Comments ({totalCount})
      </Heading>

      {/* New Comment Form */}
      {currentUser && onSubmit && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <MediaObject
            avatarSrc={currentUser.avatar}
            avatarAlt={currentUser.name}
            avatarInitials={currentUser.name.slice(0, 2).toUpperCase()}
            avatarSize="sm"
            title={
              <FormField
                name="comment"
                label=""
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
            }
          />
          <div className={styles.formActions}>
            <Button type="submit" disabled={!newComment.trim()} isLoading={isLoading}>
              Post Comment
            </Button>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className={styles.list}>
        {comments.length > 0 ? (
          comments.map((comment) => renderComment(comment))
        ) : (
          <Text color="muted" className={styles.empty}>
            No comments yet. Be the first to comment!
          </Text>
        )}
      </div>
    </section>
  );
};

CommentSection.displayName = 'CommentSection';
```

## Sidebar Organism Example

```typescript
// organisms/Sidebar/Sidebar.tsx
import React from 'react';
import { Avatar } from '@/components/atoms/Avatar';
import { Text } from '@/components/atoms/Typography';
import { NavItem } from '@/components/molecules/NavItem';
import styles from './Sidebar.module.css';

export interface SidebarLink {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

export interface SidebarSection {
  title?: string;
  links: SidebarLink[];
}

export interface SidebarProps {
  /** User info */
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  /** Navigation sections */
  sections: SidebarSection[];
  /** Active link ID */
  activeId?: string;
  /** Collapsed state */
  isCollapsed?: boolean;
  /** Toggle collapse handler */
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  sections,
  activeId,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}
    >
      {/* User Info */}
      {user && (
        <div className={styles.user}>
          <Avatar
            src={user.avatar}
            alt={user.name}
            initials={user.name.slice(0, 2).toUpperCase()}
            size={isCollapsed ? 'sm' : 'md'}
          />
          {!isCollapsed && (
            <div className={styles.userInfo}>
              <Text weight="semibold" truncate>
                {user.name}
              </Text>
              <Text size="sm" color="muted" truncate>
                {user.email}
              </Text>
            </div>
          )}
        </div>
      )}

      {/* Navigation Sections */}
      <nav className={styles.nav}>
        {sections.map((section, index) => (
          <div key={index} className={styles.section}>
            {section.title && !isCollapsed && (
              <Text size="xs" color="muted" className={styles.sectionTitle}>
                {section.title}
              </Text>
            )}
            <ul className={styles.links}>
              {section.links.map((link) => (
                <li key={link.id}>
                  <NavItem
                    label={isCollapsed ? '' : link.label}
                    href={link.href}
                    icon={link.icon}
                    badge={isCollapsed ? undefined : link.badge}
                    isActive={link.id === activeId}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      {onToggleCollapse && (
        <button className={styles.collapseButton} onClick={onToggleCollapse}>
          {isCollapsed ? '>' : '<'}
        </button>
      )}
    </aside>
  );
};

Sidebar.displayName = 'Sidebar';
```

## DataTable Organism Example

```typescript
// organisms/DataTable/DataTable.tsx
import React, { useState } from 'react';
import { Checkbox } from '@/components/atoms/Checkbox';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Typography';
import { ListItem } from '@/components/molecules/ListItem';
import styles from './DataTable.module.css';

export interface Column<T> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T extends { id: string }> {
  /** Table columns */
  columns: Column<T>[];
  /** Table data */
  data: T[];
  /** Selected row IDs */
  selectedIds?: string[];
  /** Selection change handler */
  onSelectionChange?: (ids: string[]) => void;
  /** Sort field */
  sortField?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Sort change handler */
  onSort?: (field: string) => void;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  selectedIds = [],
  onSelectionChange,
  sortField,
  sortDirection,
  onSort,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const handleSelectAll = () => {
    if (onSelectionChange) {
      onSelectionChange(allSelected ? [] : data.map((row) => row.id));
    }
  };

  const handleSelectRow = (id: string, selected: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(
        selected
          ? [...selectedIds, id]
          : selectedIds.filter((selectedId) => selectedId !== id)
      );
    }
  };

  const getCellValue = (row: T, column: Column<T>) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor] as React.ReactNode;
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            {onSelectionChange && (
              <th className={styles.checkboxCell}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={handleSelectAll}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.id}
                style={{ width: column.width }}
                className={column.sortable ? styles.sortable : ''}
                onClick={() => column.sortable && onSort?.(column.id)}
              >
                <div className={styles.headerContent}>
                  {column.header}
                  {column.sortable && sortField === column.id && (
                    <Icon
                      name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size="xs"
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody className={styles.tbody}>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length + (onSelectionChange ? 1 : 0)}>
                <div className={styles.loading}>Loading...</div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onSelectionChange ? 1 : 0)}>
                <div className={styles.empty}>
                  <Text color="muted">{emptyMessage}</Text>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                className={`${styles.row} ${
                  selectedIds.includes(row.id) ? styles.selected : ''
                } ${onRowClick ? styles.clickable : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {onSelectionChange && (
                  <td
                    className={styles.checkboxCell}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                      aria-label={`Select row ${row.id}`}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.id}>{getCellValue(row, column)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

DataTable.displayName = 'DataTable';
```

## Best Practices

### 1. Keep Business Logic Contained

```typescript
// GOOD: Organism manages its own related state
const ProductCard = ({ product, onAddToCart }) => {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = async () => {
    setIsAdding(true);
    await onAddToCart(product.id);
    setIsAdding(false);
  };

  return <Button onClick={handleAddToCart} isLoading={isAdding}>Add</Button>;
};

// BAD: State managed externally for no reason
const ProductCard = ({ product, isAdding, onAddToCart }) => {
  return <Button onClick={() => onAddToCart(product.id)} isLoading={isAdding}>Add</Button>;
};
```

### 2. Accept Data Objects

```typescript
// GOOD: Accept domain objects
interface HeaderProps {
  user: User;
  navigation: NavLink[];
}

// BAD: Flat props explosion
interface HeaderProps {
  userName: string;
  userEmail: string;
  userAvatar: string;
  navItem1Label: string;
  navItem1Href: string;
  // ...endless props
}
```

### 3. Compose with Clear Hierarchy

```typescript
// GOOD: Clear molecule/atom composition
const Header = () => (
  <header>
    <Logo />                    {/* Atom */}
    <Navigation>                {/* Molecule */}
      <NavItem />
      <NavItem />
    </Navigation>
    <SearchForm />              {/* Molecule */}
    <UserMenu />                {/* Molecule */}
  </header>
);
```

## Anti-Patterns to Avoid

### 1. Organisms Within Organisms

```typescript
// BAD: Nesting organisms
const Dashboard = () => (
  <div>
    <Header />                  {/* Organism */}
    <Sidebar />                 {/* Organism */}
    <MainContent>
      <DataTable />             {/* Another organism */}
    </MainContent>
  </div>
);

// This should be a template, not an organism!
```

### 2. Too Generic Organisms

```typescript
// BAD: Generic "Section" organism
const Section = ({ children }) => <section>{children}</section>;

// GOOD: Specific, purposeful organisms
const ProductSection = ({ products }) => { ... };
const CommentSection = ({ comments }) => { ... };
```

## When to Use This Skill

- Building page sections like headers and footers
- Creating complex interactive components
- Assembling product or content cards
- Building data display components
- Creating form containers with validation

## Related Skills

- `atomic-design-fundamentals` - Core methodology overview
- `atomic-design-molecules` - Composing atoms into molecules
- `atomic-design-templates` - Page layouts without content

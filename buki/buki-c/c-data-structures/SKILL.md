---
name: c-data-structures
description: Use when fundamental C data structures including arrays, structs, linked lists, trees, and hash tables with memory-efficient implementations.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# C Data Structures

Data structures in C require manual memory management and careful pointer
manipulation. Understanding how to implement and use fundamental data
structures is essential for building efficient C applications. This skill
covers arrays, structs, linked lists, trees, and hash tables.

## Arrays and Dynamic Arrays

Arrays provide contiguous memory storage with O(1) access time. Dynamic arrays
offer flexibility at the cost of occasional reallocation.

### Static Arrays

```c
#include <stdio.h>
#include <string.h>

// Working with static arrays
void array_operations(void) {
    int numbers[5] = {1, 2, 3, 4, 5};

    // Array length (only works with static arrays)
    size_t length = sizeof(numbers) / sizeof(numbers[0]);

    // Iterate through array
    for (size_t i = 0; i < length; i++) {
        printf("%d ", numbers[i]);
    }
    printf("\n");

    // Array as function parameter (decays to pointer)
    int sum = 0;
    for (size_t i = 0; i < length; i++) {
        sum += numbers[i];
    }
    printf("Sum: %d\n", sum);
}
```

### Dynamic Arrays

```c
#include <stdlib.h>
#include <string.h>

typedef struct {
    int *data;
    size_t size;
    size_t capacity;
} DynamicArray;

// Initialize dynamic array
DynamicArray *array_create(size_t initial_capacity) {
    DynamicArray *arr = malloc(sizeof(DynamicArray));
    if (!arr) return NULL;

    arr->data = malloc(initial_capacity * sizeof(int));
    if (!arr->data) {
        free(arr);
        return NULL;
    }

    arr->size = 0;
    arr->capacity = initial_capacity;
    return arr;
}

// Append element to array
int array_push(DynamicArray *arr, int value) {
    if (arr->size >= arr->capacity) {
        size_t new_capacity = arr->capacity * 2;
        int *new_data = realloc(arr->data, new_capacity * sizeof(int));
        if (!new_data) return -1;

        arr->data = new_data;
        arr->capacity = new_capacity;
    }

    arr->data[arr->size++] = value;
    return 0;
}

// Free array memory
void array_free(DynamicArray *arr) {
    if (arr) {
        free(arr->data);
        free(arr);
    }
}
```

## Structs and Data Modeling

Structs group related data together, enabling complex data modeling and
organization.

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Define a structure
typedef struct {
    char name[50];
    int age;
    float salary;
} Employee;

// Create and initialize struct
Employee *employee_create(const char *name, int age, float salary) {
    Employee *emp = malloc(sizeof(Employee));
    if (!emp) return NULL;

    strncpy(emp->name, name, sizeof(emp->name) - 1);
    emp->name[sizeof(emp->name) - 1] = '\0';
    emp->age = age;
    emp->salary = salary;

    return emp;
}

// Struct with nested structures
typedef struct {
    int x;
    int y;
} Point;

typedef struct {
    Point top_left;
    Point bottom_right;
} Rectangle;

// Calculate rectangle area
int rectangle_area(const Rectangle *rect) {
    int width = rect->bottom_right.x - rect->top_left.x;
    int height = rect->bottom_right.y - rect->top_left.y;
    return width * height;
}
```

## Linked Lists

Linked lists provide dynamic insertion and deletion with O(1) time complexity
for operations at known positions.

```c
#include <stdio.h>
#include <stdlib.h>

// Singly linked list node
typedef struct Node {
    int data;
    struct Node *next;
} Node;

typedef struct {
    Node *head;
    size_t size;
} LinkedList;

// Create new list
LinkedList *list_create(void) {
    LinkedList *list = malloc(sizeof(LinkedList));
    if (!list) return NULL;

    list->head = NULL;
    list->size = 0;
    return list;
}

// Insert at beginning
int list_prepend(LinkedList *list, int data) {
    Node *node = malloc(sizeof(Node));
    if (!node) return -1;

    node->data = data;
    node->next = list->head;
    list->head = node;
    list->size++;

    return 0;
}

// Insert at end
int list_append(LinkedList *list, int data) {
    Node *node = malloc(sizeof(Node));
    if (!node) return -1;

    node->data = data;
    node->next = NULL;

    if (!list->head) {
        list->head = node;
    } else {
        Node *current = list->head;
        while (current->next) {
            current = current->next;
        }
        current->next = node;
    }

    list->size++;
    return 0;
}

// Remove first occurrence of value
int list_remove(LinkedList *list, int data) {
    if (!list->head) return -1;

    // Remove head node
    if (list->head->data == data) {
        Node *temp = list->head;
        list->head = list->head->next;
        free(temp);
        list->size--;
        return 0;
    }

    // Remove other node
    Node *current = list->head;
    while (current->next) {
        if (current->next->data == data) {
            Node *temp = current->next;
            current->next = current->next->next;
            free(temp);
            list->size--;
            return 0;
        }
        current = current->next;
    }

    return -1;  // Not found
}

// Free entire list
void list_free(LinkedList *list) {
    if (!list) return;

    Node *current = list->head;
    while (current) {
        Node *next = current->next;
        free(current);
        current = next;
    }

    free(list);
}
```

## Doubly Linked Lists

Doubly linked lists allow bidirectional traversal with previous and next
pointers.

```c
#include <stdlib.h>

// Doubly linked list node
typedef struct DNode {
    int data;
    struct DNode *prev;
    struct DNode *next;
} DNode;

typedef struct {
    DNode *head;
    DNode *tail;
    size_t size;
} DoublyLinkedList;

// Create new doubly linked list
DoublyLinkedList *dlist_create(void) {
    DoublyLinkedList *list = malloc(sizeof(DoublyLinkedList));
    if (!list) return NULL;

    list->head = NULL;
    list->tail = NULL;
    list->size = 0;
    return list;
}

// Insert at end (O(1) with tail pointer)
int dlist_append(DoublyLinkedList *list, int data) {
    DNode *node = malloc(sizeof(DNode));
    if (!node) return -1;

    node->data = data;
    node->next = NULL;
    node->prev = list->tail;

    if (list->tail) {
        list->tail->next = node;
    } else {
        list->head = node;
    }

    list->tail = node;
    list->size++;
    return 0;
}

// Remove from end (O(1) with tail pointer)
int dlist_pop(DoublyLinkedList *list, int *data) {
    if (!list->tail) return -1;

    *data = list->tail->data;
    DNode *node = list->tail;

    if (list->tail->prev) {
        list->tail = list->tail->prev;
        list->tail->next = NULL;
    } else {
        list->head = NULL;
        list->tail = NULL;
    }

    free(node);
    list->size--;
    return 0;
}
```

## Binary Trees

Binary trees organize data hierarchically, enabling efficient searching,
insertion, and traversal operations.

```c
#include <stdio.h>
#include <stdlib.h>

// Binary tree node
typedef struct TreeNode {
    int data;
    struct TreeNode *left;
    struct TreeNode *right;
} TreeNode;

// Create new tree node
TreeNode *tree_node_create(int data) {
    TreeNode *node = malloc(sizeof(TreeNode));
    if (!node) return NULL;

    node->data = data;
    node->left = NULL;
    node->right = NULL;
    return node;
}

// Insert into binary search tree
TreeNode *bst_insert(TreeNode *root, int data) {
    if (!root) {
        return tree_node_create(data);
    }

    if (data < root->data) {
        root->left = bst_insert(root->left, data);
    } else if (data > root->data) {
        root->right = bst_insert(root->right, data);
    }

    return root;
}

// Search in binary search tree
TreeNode *bst_search(TreeNode *root, int data) {
    if (!root || root->data == data) {
        return root;
    }

    if (data < root->data) {
        return bst_search(root->left, data);
    }

    return bst_search(root->right, data);
}

// In-order traversal (sorted order for BST)
void tree_inorder(TreeNode *root) {
    if (!root) return;

    tree_inorder(root->left);
    printf("%d ", root->data);
    tree_inorder(root->right);
}

// Free entire tree
void tree_free(TreeNode *root) {
    if (!root) return;

    tree_free(root->left);
    tree_free(root->right);
    free(root);
}
```

## Hash Tables

Hash tables provide O(1) average-case insertion, deletion, and lookup using
hash functions and collision resolution.

```c
#include <stdlib.h>
#include <string.h>

#define HASH_TABLE_SIZE 100

// Hash table entry
typedef struct Entry {
    char *key;
    int value;
    struct Entry *next;  // For collision chaining
} Entry;

// Hash table
typedef struct {
    Entry *buckets[HASH_TABLE_SIZE];
    size_t size;
} HashTable;

// Hash function (djb2)
unsigned long hash(const char *str) {
    unsigned long hash = 5381;
    int c;

    while ((c = *str++)) {
        hash = ((hash << 5) + hash) + c;
    }

    return hash % HASH_TABLE_SIZE;
}

// Create hash table
HashTable *hashtable_create(void) {
    HashTable *table = malloc(sizeof(HashTable));
    if (!table) return NULL;

    for (int i = 0; i < HASH_TABLE_SIZE; i++) {
        table->buckets[i] = NULL;
    }
    table->size = 0;

    return table;
}

// Insert or update key-value pair
int hashtable_set(HashTable *table, const char *key, int value) {
    unsigned long index = hash(key);
    Entry *entry = table->buckets[index];

    // Check if key exists
    while (entry) {
        if (strcmp(entry->key, key) == 0) {
            entry->value = value;
            return 0;
        }
        entry = entry->next;
    }

    // Create new entry
    Entry *new_entry = malloc(sizeof(Entry));
    if (!new_entry) return -1;

    new_entry->key = strdup(key);
    if (!new_entry->key) {
        free(new_entry);
        return -1;
    }

    new_entry->value = value;
    new_entry->next = table->buckets[index];
    table->buckets[index] = new_entry;
    table->size++;

    return 0;
}

// Get value by key
int hashtable_get(HashTable *table, const char *key, int *value) {
    unsigned long index = hash(key);
    Entry *entry = table->buckets[index];

    while (entry) {
        if (strcmp(entry->key, key) == 0) {
            *value = entry->value;
            return 0;
        }
        entry = entry->next;
    }

    return -1;  // Not found
}

// Free hash table
void hashtable_free(HashTable *table) {
    if (!table) return;

    for (int i = 0; i < HASH_TABLE_SIZE; i++) {
        Entry *entry = table->buckets[i];
        while (entry) {
            Entry *next = entry->next;
            free(entry->key);
            free(entry);
            entry = next;
        }
    }

    free(table);
}
```

## Stacks and Queues

Stacks (LIFO) and queues (FIFO) are fundamental abstract data types with many
applications.

```c
#include <stdlib.h>
#include <stdbool.h>

// Stack using dynamic array
typedef struct {
    int *data;
    size_t size;
    size_t capacity;
} Stack;

// Create stack
Stack *stack_create(size_t initial_capacity) {
    Stack *stack = malloc(sizeof(Stack));
    if (!stack) return NULL;

    stack->data = malloc(initial_capacity * sizeof(int));
    if (!stack->data) {
        free(stack);
        return NULL;
    }

    stack->size = 0;
    stack->capacity = initial_capacity;
    return stack;
}

// Push to stack
int stack_push(Stack *stack, int value) {
    if (stack->size >= stack->capacity) {
        size_t new_capacity = stack->capacity * 2;
        int *new_data = realloc(stack->data,
                                new_capacity * sizeof(int));
        if (!new_data) return -1;

        stack->data = new_data;
        stack->capacity = new_capacity;
    }

    stack->data[stack->size++] = value;
    return 0;
}

// Pop from stack
int stack_pop(Stack *stack, int *value) {
    if (stack->size == 0) return -1;

    *value = stack->data[--stack->size];
    return 0;
}

// Peek top of stack
int stack_peek(Stack *stack, int *value) {
    if (stack->size == 0) return -1;

    *value = stack->data[stack->size - 1];
    return 0;
}

// Check if stack is empty
bool stack_is_empty(Stack *stack) {
    return stack->size == 0;
}

// Free stack
void stack_free(Stack *stack) {
    if (stack) {
        free(stack->data);
        free(stack);
    }
}
```

## Best Practices

1. Always initialize pointers to NULL to prevent accessing uninitialized memory
2. Check malloc/calloc/realloc return values before using allocated memory
3. Free all allocated memory in reverse order of allocation
4. Use sizeof(variable) instead of sizeof(type) for better maintainability
5. Keep track of data structure sizes to avoid buffer overflows
6. Use const pointers when functions should not modify data
7. Initialize all struct members explicitly to avoid undefined behavior
8. Document time and space complexity for data structure operations
9. Use typedef to create cleaner type names for structs and pointers
10. Implement destroy/free functions for all custom data structures

## Common Pitfalls

1. Forgetting to free memory, causing memory leaks in long-running programs
2. Accessing freed memory (use-after-free), causing undefined behavior
3. Freeing same memory twice (double-free), causing heap corruption
4. Not checking for NULL after malloc, leading to segmentation faults
5. Using uninitialized pointers, accessing random memory locations
6. Buffer overflows from not tracking array bounds properly
7. Returning pointers to local variables that go out of scope
8. Not updating size counters after insertion/deletion operations
9. Circular references in linked structures without proper cleanup
10. Using shallow copies when deep copies are needed, sharing mutable state

## When to Use C Data Structures

Use C data structures when you need:

- Maximum control over memory layout and access patterns
- Minimal memory overhead without garbage collection
- Predictable performance characteristics for real-time systems
- Integration with hardware or low-level system interfaces
- Building foundational libraries used by other languages
- Understanding how high-level abstractions work internally
- Educational purposes for learning algorithms and complexity analysis
- Embedded systems with limited resources requiring efficiency
- Performance-critical code where every byte matters
- Legacy codebases requiring maintenance or extension

## Resources

- [The C Programming Language](https://www.amazon.com/Programming-Language-2nd-Brian-Kernighan/dp/0131103628)
- [Data Structures Using C](https://www.amazon.com/Data-Structures-Using-Aaron-Tenenbaum/dp/0131997467)
- [Introduction to Algorithms (CLRS)](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/)
- [C Data Structures Tutorial](https://www.learn-c.org/en/Linked_lists)

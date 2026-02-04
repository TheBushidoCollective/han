---
name: Objective-C Protocols and Categories
description: Use when objective-C protocols for defining interfaces and categories for extending classes, including formal protocols, optional methods, class extensions, and patterns for modular, reusable code design.
allowed-tools: []
---

# Objective-C Protocols and Categories

## Introduction

Protocols and categories are fundamental Objective-C features for defining
interfaces and extending behavior. Protocols declare method contracts that
classes can adopt, enabling polymorphism and delegation patterns. Categories
extend existing classes with new methods without subclassing or source access.

Protocols serve similar purposes to Java interfaces or Swift protocols, enabling
multiple inheritance of behavior through composition. Categories are unique to
Objective-C, allowing developers to organize code, add functionality to system
classes, and split large implementations across multiple files.

This skill covers formal protocols, optional methods, protocol composition,
categories, class extensions, and best practices for modular Objective-C design.

## Formal Protocols

Formal protocols declare method and property requirements that adopting classes
must implement, establishing contracts for polymorphic behavior.

```objectivec
// Basic protocol declaration
@protocol Drawable <NSObject>
@required
- (void)draw;
- (CGRect)bounds;

@optional
- (void)drawWithStyle:(NSString *)style;
@end

// Protocol adoption in interface
@interface Circle : NSObject <Drawable>
@property (nonatomic, assign) CGFloat radius;
@property (nonatomic, assign) CGPoint center;
@end

@implementation Circle

- (void)draw {
    NSLog(@"Drawing circle at (%.1f, %.1f) with radius %.1f",
          self.center.x, self.center.y, self.radius);
}

- (CGRect)bounds {
    return CGRectMake(
        self.center.x - self.radius,
        self.center.y - self.radius,
        self.radius * 2,
        self.radius * 2
    );
}

@end

// Multiple protocol adoption
@protocol Movable <NSObject>
- (void)moveToPoint:(CGPoint)point;
- (CGPoint)currentPosition;
@end

@protocol Scalable <NSObject>
- (void)scaleBy:(CGFloat)factor;
- (CGFloat)currentScale;
@end

@interface Shape : NSObject <Drawable, Movable, Scalable>
@property (nonatomic, assign) CGPoint position;
@property (nonatomic, assign) CGFloat scale;
@end

@implementation Shape

- (void)draw {
    NSLog(@"Drawing shape");
}

- (CGRect)bounds {
    return CGRectZero;
}

- (void)moveToPoint:(CGPoint)point {
    self.position = point;
}

- (CGPoint)currentPosition {
    return self.position;
}

- (void)scaleBy:(CGFloat)factor {
    self.scale *= factor;
}

- (CGFloat)currentScale {
    return self.scale;
}

@end

// Protocol as type
void drawShapes(NSArray<id<Drawable>> *shapes) {
    for (id<Drawable> shape in shapes) {
        [shape draw];
        NSLog(@"Bounds: %@", NSStringFromCGRect([shape bounds]));
    }
}

// Checking protocol conformance
void checkConformance(id object) {
    if ([object conformsToProtocol:@protocol(Drawable)]) {
        id<Drawable> drawable = object;
        [drawable draw];
    }
}

// Protocol inheritance
@protocol AdvancedDrawable <Drawable>
- (void)drawWithTransform:(CGAffineTransform)transform;
- (void)drawWithBlendMode:(CGBlendMode)blendMode;
@end

@interface AdvancedShape : NSObject <AdvancedDrawable>
@end

@implementation AdvancedShape

- (void)draw {
    NSLog(@"Advanced drawing");
}

- (CGRect)bounds {
    return CGRectZero;
}

- (void)drawWithTransform:(CGAffineTransform)transform {
    NSLog(@"Drawing with transform");
}

- (void)drawWithBlendMode:(CGBlendMode)blendMode {
    NSLog(@"Drawing with blend mode");
}

@end
```

Protocols enable polymorphic code that works with any object implementing the
required methods, regardless of class hierarchy.

## Optional Protocol Methods

Optional protocol methods allow adopters to implement only relevant methods,
with runtime checking for implementation before calling.

```objectivec
// Protocol with optional methods
@protocol DataSourceDelegate <NSObject>

@required
- (NSInteger)numberOfItems;

@optional
- (NSString *)titleForItemAtIndex:(NSInteger)index;
- (UIImage *)imageForItemAtIndex:(NSInteger)index;
- (void)didSelectItemAtIndex:(NSInteger)index;

@end

// Implementing partial optional methods
@interface ListView : UIView <DataSourceDelegate>
@property (nonatomic, weak) id<DataSourceDelegate> dataSource;
@end

@implementation ListView

- (void)reloadData {
    NSInteger count = [self.dataSource numberOfItems];

    for (NSInteger i = 0; i < count; i++) {
        // Check if optional method is implemented
        if ([self.dataSource respondsToSelector:
            @selector(titleForItemAtIndex:)]) {
            NSString *title = [self.dataSource titleForItemAtIndex:i];
            NSLog(@"Title: %@", title);
        }

        if ([self.dataSource respondsToSelector:
            @selector(imageForItemAtIndex:)]) {
            UIImage *image = [self.dataSource imageForItemAtIndex:i];
            NSLog(@"Image: %@", image);
        }
    }
}

// Required method implementation
- (NSInteger)numberOfItems {
    return 0;
}

@end

// Selective implementation in adopter
@interface SimpleDataSource : NSObject <DataSourceDelegate>
@end

@implementation SimpleDataSource

- (NSInteger)numberOfItems {
    return 10;
}

- (NSString *)titleForItemAtIndex:(NSInteger)index {
    return [NSString stringWithFormat:@"Item %ld", (long)index];
}

// imageForItemAtIndex: not implemented

@end

// Delegate pattern with optional methods
@protocol ViewControllerDelegate <NSObject>

@optional
- (void)viewControllerWillAppear:(UIViewController *)controller;
- (void)viewControllerDidAppear:(UIViewController *)controller;
- (void)viewControllerWillDisappear:(UIViewController *)controller;
- (void)viewControllerDidDisappear:(UIViewController *)controller;

@end

@interface CustomViewController : UIViewController
@property (nonatomic, weak) id<ViewControllerDelegate> delegate;
@end

@implementation CustomViewController

- (void)viewWillAppear:(BOOL)animated {
    [super viewWillAppear:animated];

    if ([self.delegate respondsToSelector:
        @selector(viewControllerWillAppear:)]) {
        [self.delegate viewControllerWillAppear:self];
    }
}

- (void)viewDidAppear:(BOOL)animated {
    [super viewDidAppear:animated];

    if ([self.delegate respondsToSelector:@selector(viewControllerDidAppear:)]) {
        [self.delegate viewControllerDidAppear:self];
    }
}

@end

// Property requirements in protocols
@protocol Identifiable <NSObject>

@required
@property (nonatomic, readonly) NSString *identifier;
@property (nonatomic, strong) NSString *name;

@optional
@property (nonatomic, strong) NSDictionary *metadata;

@end

@interface User : NSObject <Identifiable>
@end

@implementation User

@synthesize identifier = _identifier;
@synthesize name = _name;
// metadata not implemented (optional)

@end
```

Always check for optional method implementation with `respondsToSelector:`
before calling to prevent crashes from unimplemented methods.

## Categories for Class Extension

Categories add methods to existing classes without subclassing, enabling code
organization and extension of system classes.

```objectivec
// Basic category
@interface NSString (Validation)
- (BOOL)isValidEmail;
- (BOOL)isValidPhoneNumber;
- (NSString *)trimmedString;
@end

@implementation NSString (Validation)

- (BOOL)isValidEmail {
    NSString *emailRegex =
        @"[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";
    NSPredicate *predicate = [NSPredicate predicateWithFormat:
        @"SELF MATCHES %@", emailRegex];
    return [predicate evaluateWithObject:self];
}

- (BOOL)isValidPhoneNumber {
    NSString *phoneRegex = @"^\\d{3}-\\d{3}-\\d{4}$";
    NSPredicate *predicate = [NSPredicate predicateWithFormat:
        @"SELF MATCHES %@", phoneRegex];
    return [predicate evaluateWithObject:self];
}

- (NSString *)trimmedString {
    return [self stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
}

@end

// Using category methods
void categoryExample(void) {
    NSString *email = @"user@example.com";
    if ([email isValidEmail]) {
        NSLog(@"Valid email");
    }

    NSString *text = @"  Hello World  ";
    NSString *trimmed = [text trimmedString];
    NSLog(@"Trimmed: '%@'", trimmed);
}

// Category for code organization
@interface DataManager : NSObject
- (void)saveData:(NSData *)data;
- (NSData *)loadData;
@end

// Split functionality across categories
@interface DataManager (NetworkSync)
- (void)syncToServer;
- (void)downloadFromServer;
@end

@interface DataManager (LocalStorage)
- (void)saveToUserDefaults:(NSDictionary *)data;
- (NSDictionary *)loadFromUserDefaults;
@end

@implementation DataManager

- (void)saveData:(NSData *)data {
    NSLog(@"Saving data");
}

- (NSData *)loadData {
    return [NSData data];
}

@end

@implementation DataManager (NetworkSync)

- (void)syncToServer {
    NSLog(@"Syncing to server");
}

- (void)downloadFromServer {
    NSLog(@"Downloading from server");
}

@end

@implementation DataManager (LocalStorage)

- (void)saveToUserDefaults:(NSDictionary *)data {
    [[NSUserDefaults standardUserDefaults] setObject:data forKey:@"data"];
}

- (NSDictionary *)loadFromUserDefaults {
    return [[NSUserDefaults standardUserDefaults] dictionaryForKey:@"data"];
}

@end

// Category on UIKit classes
@interface UIColor (CustomColors)
+ (UIColor *)brandPrimaryColor;
+ (UIColor *)brandSecondaryColor;
@end

@implementation UIColor (CustomColors)

+ (UIColor *)brandPrimaryColor {
    return [UIColor colorWithRed:0.2 green:0.4 blue:0.8 alpha:1.0];
}

+ (UIColor *)brandSecondaryColor {
    return [UIColor colorWithRed:0.8 green:0.4 blue:0.2 alpha:1.0];
}

@end

// Using custom colors
void customColorExample(void) {
    UIView *view = [[UIView alloc] init];
    view.backgroundColor = [UIColor brandPrimaryColor];
}

// Category with associated objects
#import <objc/runtime.h>

@interface UIViewController (CustomProperty)
@property (nonatomic, strong) NSString *customIdentifier;
@end

@implementation UIViewController (CustomProperty)

- (NSString *)customIdentifier {
    return objc_getAssociatedObject(self, @selector(customIdentifier));
}

- (void)setCustomIdentifier:(NSString *)customIdentifier {
    objc_setAssociatedObject(
        self,
        @selector(customIdentifier),
        customIdentifier,
        OBJC_ASSOCIATION_RETAIN_NONATOMIC
    );
}

@end
```

Categories cannot add instance variables but can add methods and use associated
objects for property-like behavior.

## Class Extensions

Class extensions are anonymous categories declared in implementation files that
can add private methods and properties invisible to clients.

```objectivec
// Public interface
@interface Person : NSObject
@property (nonatomic, strong, readonly) NSString *name;
@property (nonatomic, assign, readonly) NSInteger age;

- (instancetype)initWithName:(NSString *)name age:(NSInteger)age;
- (NSString *)description;
@end

// Class extension (private interface)
@interface Person ()
// Make readonly properties readwrite internally
@property (nonatomic, strong, readwrite) NSString *name;
@property (nonatomic, assign, readwrite) NSInteger age;

// Private properties
@property (nonatomic, strong) NSString *internalID;
@property (nonatomic, strong) NSMutableArray *privateData;

// Private methods
- (void)validateData;
- (void)logAccess;
@end

@implementation Person

- (instancetype)initWithName:(NSString *)name age:(NSInteger)age {
    self = [super init];
    if (self) {
        self.name = name;
        self.age = age;
        self.internalID = [[NSUUID UUID] UUIDString];
        self.privateData = [NSMutableArray array];
        [self validateData];
    }
    return self;
}

- (NSString *)description {
    [self logAccess];
    return [NSString stringWithFormat:@"%@ (%ld)", self.name, (long)self.age];
}

// Private method implementations
- (void)validateData {
    NSAssert(self.name.length > 0, @"Name must not be empty");
    NSAssert(self.age >= 0, @"Age must be non-negative");
}

- (void)logAccess {
    NSLog(@"Accessed person: %@", self.internalID);
}

@end

// Network manager with private implementation
@interface NetworkManager : NSObject
- (void)fetchDataFromURL:(NSURL *)url completion:
    (void (^)(NSData *data, NSError *error))completion;
@end

@interface NetworkManager ()
@property (nonatomic, strong) NSURLSession *session;
@property (nonatomic, strong) NSMutableDictionary *activeRequests;

- (void)configureSession;
- (void)handleResponse:(NSURLResponse *)response data:(NSData *)data
                 error:(NSError *)error;
@end

@implementation NetworkManager

- (instancetype)init {
    self = [super init];
    if (self) {
        self.activeRequests = [NSMutableDictionary dictionary];
        [self configureSession];
    }
    return self;
}

- (void)fetchDataFromURL:(NSURL *)url completion:
    (void (^)(NSData *, NSError *))completion {
    NSURLSessionDataTask *task = [self.session dataTaskWithURL:url
        completionHandler:^(NSData *data, NSURLResponse *response,
                            NSError *error) {
        [self handleResponse:response data:data error:error];
        if (completion) {
            completion(data, error);
        }
    }];

    [task resume];
}

- (void)configureSession {
    NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
    self.session = [NSURLSession sessionWithConfiguration:config];
}

- (void)handleResponse:(NSURLResponse *)response data:(NSData *)data
                 error:(NSError *)error {
    // Private response handling
    NSLog(@"Response received");
}

@end

// View controller with private outlets
@interface ProfileViewController : UIViewController
- (void)loadProfile;
@end

@interface ProfileViewController ()
@property (nonatomic, weak) IBOutlet UILabel *nameLabel;
@property (nonatomic, weak) IBOutlet UIImageView *profileImageView;
@property (nonatomic, strong) Person *currentPerson;

- (void)updateUI;
- (void)showError:(NSError *)error;
@end

@implementation ProfileViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    [self loadProfile];
}

- (void)loadProfile {
    self.currentPerson = [[Person alloc] initWithName:@"Alice" age:30];
    [self updateUI];
}

- (void)updateUI {
    self.nameLabel.text = self.currentPerson.name;
    // Update UI with current person
}

- (void)showError:(NSError *)error {
    UIAlertController *alert = [UIAlertController
        alertControllerWithTitle:@"Error"
        message:error.localizedDescription
        preferredStyle:UIAlertControllerStyleAlert];
    [alert addAction:[UIAlertAction actionWithTitle:@"OK"
        style:UIAlertActionStyleDefault handler:nil]];
    [self presentViewController:alert animated:YES completion:nil];
}

@end
```

Class extensions hide implementation details and provide a clean separation
between public API and private implementation.

## Protocol Composition

Protocol composition combines multiple protocols to create precise type
requirements without creating new protocol hierarchies.

```objectivec
// Individual protocols
@protocol Serializable <NSObject>
- (NSDictionary *)toDictionary;
- (instancetype)initWithDictionary:(NSDictionary *)dict;
@end

@protocol Cacheable <NSObject>
- (NSString *)cacheKey;
- (NSTimeInterval)cacheLifetime;
@end

@protocol Syncable <NSObject>
- (void)syncToServer:(void (^)(BOOL success))completion;
- (BOOL)needsSync;
@end

// Function requiring multiple protocols
void saveAndSync(id<Serializable, Cacheable, Syncable> object) {
    // Save to cache
    NSDictionary *dict = [object toDictionary];
    NSString *key = [object cacheKey];
    NSLog(@"Saving %@ to cache with key %@", dict, key);

    // Sync if needed
    if ([object needsSync]) {
        [object syncToServer:^(BOOL success) {
            NSLog(@"Sync %@", success ? @"succeeded" : @"failed");
        }];
    }
}

// Class implementing multiple protocols
@interface UserData : NSObject <Serializable, Cacheable, Syncable>
@property (nonatomic, strong) NSString *userID;
@property (nonatomic, strong) NSString *name;
@property (nonatomic, strong) NSString *email;
@property (nonatomic, assign) BOOL modified;
@end

@implementation UserData

- (NSDictionary *)toDictionary {
    return @{
        @"userID": self.userID ?: @"",
        @"name": self.name ?: @"",
        @"email": self.email ?: @""
    };
}

- (instancetype)initWithDictionary:(NSDictionary *)dict {
    self = [super init];
    if (self) {
        self.userID = dict[@"userID"];
        self.name = dict[@"name"];
        self.email = dict[@"email"];
        self.modified = NO;
    }
    return self;
}

- (NSString *)cacheKey {
    return [NSString stringWithFormat:@"user_%@", self.userID];
}

- (NSTimeInterval)cacheLifetime {
    return 3600; // 1 hour
}

- (void)syncToServer:(void (^)(BOOL))completion {
    // Simulate sync
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        self.modified = NO;
        if (completion) completion(YES);
    });
}

- (BOOL)needsSync {
    return self.modified;
}

@end

// Using protocol composition
void protocolCompositionExample(void) {
    UserData *user = [[UserData alloc] init];
    user.userID = @"123";
    user.name = @"Alice";
    user.email = @"alice@example.com";
    user.modified = YES;

    saveAndSync(user);
}

// Collection with protocol requirements
@interface DataStore : NSObject
@property (nonatomic, strong) NSMutableArray<id<Serializable, Cacheable>> *items;

- (void)addItem:(id<Serializable, Cacheable>)item;
- (id<Serializable, Cacheable>)itemWithKey:(NSString *)key;
@end

@implementation DataStore

- (instancetype)init {
    self = [super init];
    if (self) {
        self.items = [NSMutableArray array];
    }
    return self;
}

- (void)addItem:(id<Serializable, Cacheable>)item {
    [self.items addObject:item];
}

- (id<Serializable, Cacheable>)itemWithKey:(NSString *)key {
    for (id<Serializable, Cacheable> item in self.items) {
        if ([[item cacheKey] isEqualToString:key]) {
            return item;
        }
    }
    return nil;
}

@end
```

Protocol composition creates precise constraints without the complexity and
fragility of deep protocol inheritance hierarchies.

## Best Practices

1. **Use protocols for abstraction and polymorphism** to define contracts that
   enable flexible, testable architectures

2. **Make delegates weak properties** to prevent retain cycles in delegation
   patterns common in Cocoa and UIKit

3. **Organize large classes with categories** by splitting implementations
   across files for related functionality

4. **Hide implementation details in class extensions** to provide clean public
   APIs while keeping internal complexity private

5. **Check optional method implementation** with respondsToSelector: before
   calling to prevent crashes

6. **Adopt NSObject protocol** in custom protocols to inherit basic object
   methods like isEqual: and hash

7. **Prefer protocol composition over inheritance** to combine requirements
   without creating complex hierarchies

8. **Avoid adding state in categories** as instance variables aren't supported;
   use associated objects sparingly

9. **Document protocol semantics clearly** beyond signatures to explain expected
   behavior and usage contracts

10. **Use unique category names** by prefixing with project or company
    identifier to prevent name collisions

## Common Pitfalls

1. **Adding instance variables in categories** is not possible and causes
   compilation errors; use associated objects if needed

2. **Category method name collisions** overwrite existing methods without
   warning, causing subtle bugs

3. **Not checking optional protocol methods** before calling causes crashes when
   adopters don't implement them

4. **Forgetting to mark protocols as NSObject-conforming** loses basic methods
   like respondsToSelector:

5. **Overusing associated objects** for state in categories creates hard-to-find
   bugs and memory management issues

6. **Creating circular protocol dependencies** makes headers difficult to
   compile and organize

7. **Not declaring protocol conformance in header** when implementing in
   implementation file hides adoption from clients

8. **Using protocols as weak types incorrectly** by not understanding that
   protocol types don't support weak without explicit storage

9. **Creating overly large protocols** that mix unrelated concerns violates
   interface segregation principle

10. **Assuming category load order** can cause issues if initialization depends
    on specific category loading sequence

## When to Use This Skill

Use protocols when designing abstractions, delegation patterns, or data source
interfaces in iOS, macOS, watchOS, or tvOS applications.

Apply categories when extending system classes like NSString or UIColor, or
organizing large class implementations across multiple files.

Employ class extensions to hide private implementation details, IBOutlets, and
internal properties from public headers.

Leverage protocol composition when creating precise type requirements that
combine multiple capabilities without inheritance.

Use optional protocol methods for delegate and data source patterns where
implementers should only provide relevant callbacks.

## Resources

- [Working with Protocols](<https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/WorkingwithProtocols/WorkingwithProtocols.html>)
- [Customizing Existing Classes](<https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/CustomizingExistingClasses/CustomizingExistingClasses.html>)
- [Objective-C Runtime Programming Guide](<https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ObjCRuntimeGuide/>)
- [Cocoa Design Patterns](<https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/CocoaFundamentals/CocoaDesignPatterns/CocoaDesignPatterns.html>)
- [Associated Objects Documentation](<https://nshipster.com/associated-objects/>)

---
name: ruby-standard-library
description: Use when working with Ruby's standard library including Enumerable, File I/O, Time/Date, Regular Expressions, and core classes.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Ruby Standard Library

Master Ruby's rich standard library. Ruby comes with powerful built-in classes and modules that handle common programming tasks elegantly.

## Enumerable

The Enumerable module provides iteration methods for collections.

### Common Enumerable Methods

```ruby
numbers = [1, 2, 3, 4, 5]

# map/collect - Transform elements
numbers.map { |n| n * 2 }  # [2, 4, 6, 8, 10]
numbers.map(&:to_s)        # ["1", "2", "3", "4", "5"]

# select/filter - Keep elements matching condition
numbers.select { |n| n.even? }  # [2, 4]
numbers.filter(&:odd?)          # [1, 3, 5]

# reject - Remove elements matching condition
numbers.reject { |n| n.even? }  # [1, 3, 5]

# find/detect - First element matching condition
numbers.find { |n| n > 3 }  # 4

# find_all - All elements matching condition (alias for select)
numbers.find_all { |n| n > 2 }  # [3, 4, 5]

# reduce/inject - Accumulate values
numbers.reduce(0) { |sum, n| sum + n }  # 15
numbers.reduce(:+)  # 15
numbers.reduce(:*)  # 120

# each - Iterate over elements
numbers.each { |n| puts n }

# each_with_index - Iterate with index
numbers.each_with_index { |n, i| puts "#{i}: #{n}" }

# each_with_object - Iterate with mutable object
numbers.each_with_object({}) { |n, hash| hash[n] = n * 2 }

# any? - True if any element matches
numbers.any? { |n| n > 4 }  # true
numbers.any?(&:even?)       # true

# all? - True if all elements match
numbers.all? { |n| n > 0 }  # true
numbers.all?(&:even?)       # false

# none? - True if no elements match
numbers.none? { |n| n < 0 }  # true

# one? - True if exactly one element matches
numbers.one? { |n| n == 3 }  # true

# partition - Split into two arrays [matching, non-matching]
evens, odds = numbers.partition(&:even?)

# group_by - Group elements by key
numbers.group_by { |n| n % 2 == 0 ? :even : :odd }
# => {:odd=>[1, 3, 5], :even=>[2, 4]}

# chunk - Group consecutive elements
[1, 2, 2, 3, 3, 3, 4].chunk(&:itself).to_a
# => [[1, [1]], [2, [2, 2]], [3, [3, 3, 3]], [4, [4]]]

# take - First n elements
numbers.take(3)  # [1, 2, 3]

# drop - Skip first n elements
numbers.drop(3)  # [4, 5]

# take_while - Elements until condition fails
numbers.take_while { |n| n < 4 }  # [1, 2, 3]

# drop_while - Skip elements until condition fails
numbers.drop_while { |n| n < 4 }  # [4, 5]

# zip - Combine arrays
[1, 2, 3].zip(['a', 'b', 'c'])  # [[1, "a"], [2, "b"], [3, "c"]]

# min, max
numbers.min  # 1
numbers.max  # 5
numbers.minmax  # [1, 5]

# sort
[3, 1, 4, 1, 5].sort  # [1, 1, 3, 4, 5]
['cat', 'dog', 'bird'].sort_by(&:length)

# uniq - Remove duplicates
[1, 2, 2, 3, 3, 3].uniq  # [1, 2, 3]

# compact - Remove nil values
[1, nil, 2, nil, 3].compact  # [1, 2, 3]

# flat_map - Map and flatten
[[1, 2], [3, 4]].flat_map { |arr| arr.map { |n| n * 2 } }  # [2, 4, 6, 8]

# tally - Count occurrences
['a', 'b', 'a', 'c', 'b', 'a'].tally  # {"a"=>3, "b"=>2, "c"=>1}
```

## Arrays

```ruby
# Creation
arr = [1, 2, 3]
arr = Array.new(3, 0)  # [0, 0, 0]
arr = Array.new(3) { |i| i * 2 }  # [0, 2, 4]

# Access
arr[0]        # First element
arr[-1]       # Last element
arr[1..3]     # Range
arr.first     # 1
arr.last      # 3
arr.at(1)     # 2

# Modification
arr << 4              # Append
arr.push(5)           # Append
arr.unshift(0)        # Prepend
arr.pop               # Remove and return last
arr.shift             # Remove and return first
arr.delete_at(1)      # Delete at index
arr.delete(3)         # Delete value
arr.insert(1, 'a')    # Insert at index

# Combination
[1, 2] + [3, 4]       # [1, 2, 3, 4]
[1, 2] * 2            # [1, 2, 1, 2]
[1, 2, 3] - [2]       # [1, 3]
[1, 2] & [2, 3]       # [2] (intersection)
[1, 2] | [2, 3]       # [1, 2, 3] (union)

# Query
arr.include?(2)       # true
arr.empty?            # false
arr.length            # 3
arr.count             # 3
arr.count(2)          # Count occurrences

# Transformation
arr.reverse           # [3, 2, 1]
arr.flatten           # Flatten nested arrays
arr.compact           # Remove nils
arr.uniq              # Remove duplicates
arr.join(', ')        # Convert to string
arr.sample            # Random element
arr.shuffle           # Random order
```

## Hashes

```ruby
# Creation
hash = { name: 'Alice', age: 30 }
hash = Hash.new(0)  # Default value 0
hash = Hash.new { |h, k| h[k] = [] }  # Default block

# Access
hash[:name]           # 'Alice'
hash.fetch(:age)      # 30
hash.fetch(:email, 'N/A')  # With default
hash.dig(:person, :name)   # Safe nested access

# Modification
hash[:email] = 'alice@example.com'
hash.delete(:age)
hash.merge!(other_hash)
hash.transform_keys(&:to_s)
hash.transform_values { |v| v.to_s }

# Iteration
hash.each { |key, value| puts "#{key}: #{value}" }
hash.each_key { |key| puts key }
hash.each_value { |value| puts value }

# Query
hash.key?(:name)      # true
hash.value?('Alice')  # true
hash.empty?           # false
hash.size             # 2

# Transformation
hash.keys             # [:name, :age]
hash.values           # ['Alice', 30]
hash.invert           # Swap keys and values
hash.select { |k, v| v.is_a?(String) }
hash.reject { |k, v| v.nil? }
hash.compact          # Remove nil values
hash.slice(:name, :age)  # Extract subset
```

## Strings

```ruby
str = "Hello, World!"

# Case
str.upcase            # "HELLO, WORLD!"
str.downcase          # "hello, world!"
str.capitalize        # "Hello, world!"
str.swapcase          # "hELLO, wORLD!"
str.titleize          # Requires ActiveSupport

# Trimming
"  hello  ".strip    # "hello"
"  hello  ".lstrip   # "hello  "
"  hello  ".rstrip   # "  hello"

# Searching
str.include?("World")    # true
str.start_with?("Hello") # true
str.end_with?("!")       # true
str.index("World")       # 7
str.rindex("o")          # 8

# Splitting and joining
"a,b,c".split(",")       # ["a", "b", "c"]
["a", "b", "c"].join("-")  # "a-b-c"

# Replacement
str.sub("World", "Ruby")    # Replace first
str.gsub("o", "0")          # Replace all
str.delete("l")             # Remove characters
str.tr("aeiou", "12345")    # Translate characters

# Substring
str[0]                # "H"
str[0..4]             # "Hello"
str[7..]              # "World!"
str.slice(0, 5)       # "Hello"

# Query
str.empty?            # false
str.length            # 13
str.size              # 13
str.count("l")        # 3

# Conversion
"123".to_i            # 123
"3.14".to_f           # 3.14
:symbol.to_s          # "symbol"

# Encoding
str.encoding          # #<Encoding:UTF-8>
str.force_encoding("ASCII")
str.encode("ISO-8859-1")

# Multiline
text = <<~HEREDOC
  This is a
  multiline string
  with indentation removed
HEREDOC
```

## Regular Expressions

```ruby
# Creation
regex = /pattern/
regex = Regexp.new("pattern")

# Matching
"hello" =~ /ll/               # 2 (index)
"hello" !~ /zz/               # true
"hello".match(/l+/)           # #<MatchData "ll">
"hello".match?(/l+/)          # true (faster, no MatchData)

# Match data
match = "hello123".match(/(\w+)(\d+)/)
match[0]                      # "hello123" (full match)
match[1]                      # "hello" (first group)
match[2]                      # "123" (second group)

# Named captures
match = "hello123".match(/(?<word>\w+)(?<num>\d+)/)
match[:word]                  # "hello"
match[:num]                   # "123"

# String methods with regex
"hello world".scan(/\w+/)     # ["hello", "world"]
"a1b2c3".scan(/\d/)           # ["1", "2", "3"]

"hello".sub(/l/, 'L')         # "heLlo"
"hello".gsub(/l/, 'L')        # "heLLo"

"a:b:c".split(/:/)            # ["a", "b", "c"]

# Flags
/pattern/i                    # Case insensitive
/pattern/m                    # Multiline
/pattern/x                    # Extended (ignore whitespace)

# Common patterns
/\d+/                         # One or more digits
/\w+/                         # One or more word characters
/\s+/                         # One or more whitespace
/^start/                      # Start of string
/end$/                        # End of string
/[aeiou]/                     # Character class
/[^aeiou]/                    # Negated class
/(cat|dog)/                   # Alternation
```

## File I/O

```ruby
# Reading
content = File.read("file.txt")
lines = File.readlines("file.txt")

File.open("file.txt", "r") do |file|
  file.each_line do |line|
    puts line
  end
end

# Writing
File.write("file.txt", "content")

File.open("file.txt", "w") do |file|
  file.puts "line 1"
  file.puts "line 2"
end

# Appending
File.open("file.txt", "a") do |file|
  file.puts "appended line"
end

# File modes
# "r"  - Read only
# "w"  - Write (truncate)
# "a"  - Append
# "r+" - Read and write
# "w+" - Read and write (truncate)
# "a+" - Read and append

# File operations
File.exist?("file.txt")       # true/false
File.file?("file.txt")        # Is it a file?
File.directory?("dir")        # Is it a directory?
File.size("file.txt")         # Size in bytes
File.mtime("file.txt")        # Modification time
File.basename("/path/to/file.txt")  # "file.txt"
File.dirname("/path/to/file.txt")   # "/path/to"
File.extname("file.txt")      # ".txt"
File.join("path", "to", "file.txt")  # "path/to/file.txt"

# Directory operations
Dir.entries(".")              # List directory
Dir.glob("*.rb")              # Pattern matching
Dir.glob("**/*.rb")           # Recursive

Dir.mkdir("new_dir")
Dir.rmdir("old_dir")
Dir.pwd                       # Current directory
Dir.chdir("/path")            # Change directory

FileUtils.mkdir_p("a/b/c")    # Create nested dirs
FileUtils.rm_rf("dir")        # Remove recursively
FileUtils.cp("src", "dest")   # Copy file
FileUtils.mv("src", "dest")   # Move file
```

## Time and Date

```ruby
require 'time'
require 'date'

# Time
now = Time.now
utc = Time.now.utc
local = Time.now.localtime

# Components
now.year              # 2024
now.month             # 11
now.day               # 25
now.hour              # 14
now.min               # 30
now.sec               # 45
now.wday              # Day of week (0=Sunday)

# Creation
Time.new(2024, 11, 25, 14, 30, 45)
Time.parse("2024-11-25 14:30:45")
Time.at(1700000000)   # From Unix timestamp

# Formatting
now.strftime("%Y-%m-%d %H:%M:%S")
now.strftime("%B %d, %Y")          # November 25, 2024
now.iso8601                        # ISO 8601 format

# Arithmetic
now + 3600            # Add 1 hour (in seconds)
now - 86400           # Subtract 1 day
time2 - time1         # Difference in seconds

# Date
date = Date.today
date = Date.new(2024, 11, 25)
date = Date.parse("2024-11-25")

date.year             # 2024
date.month            # 11
date.day              # 25
date.wday             # 1 (Monday)

date + 7              # Add 7 days
date - 7              # Subtract 7 days
date.next_day         # Tomorrow
date.prev_day         # Yesterday
date.next_month       # Next month
date.prev_year        # Last year

# DateTime (combines Date and Time)
dt = DateTime.now
dt = DateTime.parse("2024-11-25T14:30:45")
```

## Range

```ruby
# Inclusive
(1..5).to_a           # [1, 2, 3, 4, 5]

# Exclusive
(1...5).to_a          # [1, 2, 3, 4]

# Methods
(1..10).include?(5)   # true
(1..10).cover?(5)     # true (faster)
(1..10).member?(5)    # true

(1..5).each { |n| puts n }
(1..5).map { |n| n * 2 }

# String ranges
('a'..'e').to_a       # ["a", "b", "c", "d", "e"]

# Case statement
case age
when 0..12
  "child"
when 13..19
  "teen"
else
  "adult"
end
```

## Set

```ruby
require 'set'

# Creation
set = Set.new([1, 2, 3])
set = Set[1, 2, 3]

# Operations
set.add(4)
set << 5
set.delete(3)

# Set operations
set1 | set2           # Union
set1 & set2           # Intersection
set1 - set2           # Difference
set1 ^ set2           # Symmetric difference

# Query
set.include?(2)       # true
set.empty?            # false
set.size              # 3

# Subset/superset
set1.subset?(set2)
set1.superset?(set2)
```

## Best Practices

1. **Use Enumerable methods** instead of manual loops
2. **Chain methods** for readability: `array.select(&:even?).map(&:to_s)`
3. **Use symbol-to-proc** (`&:method_name`) when possible
4. **Prefer File.open with blocks** for automatic file closing
5. **Use `fetch` for hashes** when you want to handle missing keys
6. **Leverage lazy enumerables** for large collections
7. **Use `Pathname`** for complex path operations

## Anti-Patterns

❌ **Don't use `for` loops** - use Enumerable methods
❌ **Don't forget to close files** - use blocks with File.open
❌ **Don't use `each` for transformation** - use `map`
❌ **Don't use `each` for filtering** - use `select` or `reject`
❌ **Don't mutate arrays while iterating** - use methods that return new arrays

## Related Skills

- ruby-oop - For understanding core classes
- ruby-blocks-procs-lambdas - For working with Enumerable
- ruby-metaprogramming - For advanced library usage

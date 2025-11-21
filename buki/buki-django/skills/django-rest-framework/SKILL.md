---
name: django-rest-framework
description: Use when Django REST Framework for building APIs with serializers, viewsets, and authentication. Use when creating RESTful APIs.
allowed-tools:
  - Bash
  - Read
---

# Django REST Framework

Master Django REST Framework for building robust, scalable RESTful
APIs with proper serialization and authentication.

## Serializers

Build type-safe data serialization with Django REST Framework serializers.

```python
from rest_framework import serializers
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'post_count', 'full_name']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'email': {'required': True},
            'password': {'write_only': True}
        }

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    author_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Post
        fields = '__all__'

    def validate_title(self, value):
        if len(value) < 5:
            raise serializers.ValidationError('Title must be at least 5 characters')
        return value

    def validate(self, data):
        if data.get('published') and not data.get('content'):
            raise serializers.ValidationError('Published posts must have content')
        return data

    def create(self, validated_data):
        # Custom creation logic
        post = Post.objects.create(**validated_data)
        # Send notification, etc.
        return post
```

## Custom Fields and Validation

Create custom serializer fields for complex data types.

```python
from rest_framework import serializers

class Base64ImageField(serializers.ImageField):
    """Handle base64 encoded images."""

    def to_internal_value(self, data):
        import base64
        from django.core.files.base import ContentFile

        if isinstance(data, str) and data.startswith('data:image'):
            format, imgstr = data.split(';base64,')
            ext = format.split('/')[-1]
            data = ContentFile(base64.b64decode(imgstr), name=f'temp.{ext}')

        return super().to_internal_value(data)

class PostSerializer(serializers.ModelSerializer):
    image = Base64ImageField(required=False)

    class Meta:
        model = Post
        fields = ['id', 'title', 'image']

# Custom validators
def validate_no_profanity(value):
    profanity_words = ['bad', 'worse']
    if any(word in value.lower() for word in profanity_words):
        raise serializers.ValidationError('Content contains profanity')
    return value

class CommentSerializer(serializers.ModelSerializer):
    content = serializers.CharField(validators=[validate_no_profanity])

    class Meta:
        model = Comment
        fields = ['id', 'content', 'created_at']
```

## Nested Serializers

Handle complex nested relationships.

```python
class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'content', 'author', 'created_at']

class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'title', 'content', 'author', 'comments']

# Writable nested serializers
class PostCreateSerializer(serializers.ModelSerializer):
    comments = CommentSerializer(many=True, required=False)

    class Meta:
        model = Post
        fields = ['id', 'title', 'content', 'comments']

    def create(self, validated_data):
        comments_data = validated_data.pop('comments', [])
        post = Post.objects.create(**validated_data)

        for comment_data in comments_data:
            Comment.objects.create(post=post, **comment_data)

        return post

# Dynamic nested serialization
class PostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['id', 'title', 'content']

    def __init__(self, *args, **kwargs):
        include_comments = kwargs.pop('include_comments', False)
        super().__init__(*args, **kwargs)

        if include_comments:
            self.fields['comments'] = CommentSerializer(many=True, read_only=True)
```

## ViewSets

Create RESTful endpoints with ViewSets.

```python
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ['author', 'published']
    search_fields = ['title', 'content']
    ordering_fields = ['created_at', 'title']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == 'list':
            queryset = queryset.filter(published=True)
        return queryset.select_related('author').prefetch_related('comments')

    def get_serializer_class(self):
        if self.action == 'create':
            return PostCreateSerializer
        return PostSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        post = self.get_object()
        post.published = True
        post.save()
        return Response({'status': 'published'})

    @action(detail=False, methods=['get'])
    def recent(self, request):
        recent_posts = self.get_queryset()[:10]
        serializer = self.get_serializer(recent_posts, many=True)
        return Response(serializer.data)

# ReadOnly ViewSet
class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
```

## Routers

Configure URL routing for ViewSets.

```python
from rest_framework.routers import DefaultRouter, SimpleRouter
from django.urls import path, include

# Default router (with API root view)
router = DefaultRouter()
router.register(r'posts', PostViewSet, basename='post')
router.register(r'users', UserViewSet, basename='user')
router.register(r'comments', CommentViewSet, basename='comment')

urlpatterns = [
    path('api/', include(router.urls)),
]

# Simple router (no API root)
simple_router = SimpleRouter()
simple_router.register(r'posts', PostViewSet)

# Custom routing
from rest_framework.routers import Route, DynamicRoute

class CustomRouter(DefaultRouter):
    routes = [
        Route(
            url=r'^{prefix}/$',
            mapping={'get': 'list', 'post': 'create'},
            name='{basename}-list',
            detail=False,
            initkwargs={}
        ),
        # Add custom routes
    ]
```

## Permissions

Implement authentication and authorization.

```python
from rest_framework import permissions

class IsAuthorOrReadOnly(permissions.BasePermission):
    """Custom permission to only allow authors to edit."""

    def has_object_permission(self, request, view, obj):
        # Read permissions for any request
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions only for author
        return obj.author == request.user

class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user or request.user.is_staff

# Usage in ViewSet
class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated, IsAuthorOrReadOnly]

# Multiple permission classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser

class AdminPostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
```

## Authentication

Configure various authentication methods.

```python
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated

# Token Authentication
class PostViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Post.objects.all()
    serializer_class = PostSerializer

# Create token for user
from rest_framework.authtoken.views import obtain_auth_token
from django.urls import path

urlpatterns = [
    path('api-token-auth/', obtain_auth_token),
]

# Custom token authentication
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response

class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email
        })

# JWT Authentication (using djangorestframework-simplejwt)
from rest_framework_simplejwt.authentication import JWTAuthentication

class PostViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
```

## Filtering and Search

Implement advanced filtering capabilities.

```python
from django_filters import rest_framework as filters
from rest_framework import filters as drf_filters

class PostFilter(filters.FilterSet):
    title = filters.CharFilter(lookup_expr='icontains')
    created_after = filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    class Meta:
        model = Post
        fields = ['author', 'published', 'title']

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    filter_backends = [
        filters.DjangoFilterBackend,
        drf_filters.SearchFilter,
        drf_filters.OrderingFilter
    ]
    filterset_class = PostFilter
    search_fields = ['title', 'content', 'author__name']
    ordering_fields = ['created_at', 'title', 'views']
    ordering = ['-created_at']

# Custom filter backend
class IsOwnerFilterBackend(filters.BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        return queryset.filter(owner=request.user)
```

## Pagination

Configure pagination for large datasets.

```python
from rest_framework.pagination import PageNumberPagination, LimitOffsetPagination, CursorPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    pagination_class = StandardResultsSetPagination

# Cursor pagination for better performance
class PostCursorPagination(CursorPagination):
    page_size = 20
    ordering = '-created_at'

# Custom pagination
class CustomPagination(PageNumberPagination):
    def get_paginated_response(self, data):
        return Response({
            'links': {
                'next': self.get_next_link(),
                'previous': self.get_previous_link()
            },
            'count': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'results': data
        })
```

## Throttling

Rate limit API requests.

```python
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle

class BurstRateThrottle(UserRateThrottle):
    rate = '60/min'

class SustainedRateThrottle(UserRateThrottle):
    rate = '1000/day'

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    throttle_classes = [BurstRateThrottle, SustainedRateThrottle]

# Custom throttle
from rest_framework.throttling import SimpleRateThrottle

class UploadRateThrottle(SimpleRateThrottle):
    rate = '10/hour'

    def get_cache_key(self, request, view):
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}
```

## Versioning

Handle API versioning.

```python
from rest_framework.versioning import URLPathVersioning, NamespaceVersioning

# URL path versioning
class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    versioning_class = URLPathVersioning

    def get_serializer_class(self):
        if self.request.version == 'v1':
            return PostSerializerV1
        return PostSerializerV2

# URLs
urlpatterns = [
    path('v1/posts/', PostViewSet.as_view({'get': 'list'})),
    path('v2/posts/', PostViewSet.as_view({'get': 'list'})),
]

# Accept header versioning
from rest_framework.versioning import AcceptHeaderVersioning

REST_FRAMEWORK = {
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.AcceptHeaderVersioning',
    'DEFAULT_VERSION': 'v1',
    'ALLOWED_VERSIONS': ['v1', 'v2'],
}
```

## Error Handling

Implement custom error responses.

```python
from rest_framework.views import exception_handler
from rest_framework.response import Response

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        response.data = {
            'error': {
                'status_code': response.status_code,
                'message': response.data,
                'detail': str(exc)
            }
        }

    return response

# settings.py
REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'myapp.utils.custom_exception_handler'
}

# Custom exceptions
from rest_framework.exceptions import APIException

class ServiceUnavailable(APIException):
    status_code = 503
    default_detail = 'Service temporarily unavailable'
    default_code = 'service_unavailable'

# Usage
from rest_framework import status
from rest_framework.response import Response

class PostViewSet(viewsets.ModelViewSet):
    def create(self, request):
        try:
            # Logic
            pass
        except Exception as e:
            raise ServiceUnavailable(detail=str(e))
```

## Advanced Serializer Patterns

Master complex serialization scenarios.

```python
from rest_framework import serializers

# Dynamic field selection
class DynamicFieldsModelSerializer(serializers.ModelSerializer):
    """Serializer that accepts 'fields' parameter to dynamically include/exclude fields."""

    def __init__(self, *args, **kwargs):
        fields = kwargs.pop('fields', None)
        exclude = kwargs.pop('exclude', None)

        super().__init__(*args, **kwargs)

        if fields is not None:
            allowed = set(fields)
            existing = set(self.fields)
            for field_name in existing - allowed:
                self.fields.pop(field_name)

        if exclude is not None:
            for field_name in exclude:
                self.fields.pop(field_name, None)

class PostSerializer(DynamicFieldsModelSerializer):
    class Meta:
        model = Post
        fields = '__all__'

# Usage:
serializer = PostSerializer(post, fields=('id', 'title', 'author'))
serializer = PostSerializer(post, exclude=('content',))

# Serializer method field with context
class PostSerializer(serializers.ModelSerializer):
    is_liked = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'title', 'is_liked', 'like_count']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_like_count(self, obj):
        return obj.likes.count()

# Nested writable serializers
class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'content', 'author', 'author_name']

class PostSerializer(serializers.ModelSerializer):
    comments = CommentSerializer(many=True, required=False)

    class Meta:
        model = Post
        fields = ['id', 'title', 'content', 'comments']

    def create(self, validated_data):
        comments_data = validated_data.pop('comments', [])
        post = Post.objects.create(**validated_data)

        for comment_data in comments_data:
            Comment.objects.create(post=post, **comment_data)

        return post

    def update(self, instance, validated_data):
        comments_data = validated_data.pop('comments', None)

        instance.title = validated_data.get('title', instance.title)
        instance.content = validated_data.get('content', instance.content)
        instance.save()

        if comments_data is not None:
            # Clear existing comments
            instance.comments.all().delete()

            # Create new comments
            for comment_data in comments_data:
                Comment.objects.create(post=instance, **comment_data)

        return instance

# Polymorphic serialization
class ContentSerializer(serializers.Serializer):
    """Base serializer for polymorphic content."""

    def to_representation(self, instance):
        if isinstance(instance, Article):
            return ArticleSerializer(instance, context=self.context).data
        elif isinstance(instance, Video):
            return VideoSerializer(instance, context=self.context).data
        elif isinstance(instance, Image):
            return ImageSerializer(instance, context=self.context).data
        return super().to_representation(instance)
```

## ViewSet Composition and Actions

Build sophisticated ViewSets with custom actions.

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by query parameters
        author = self.request.query_params.get('author')
        if author:
            queryset = queryset.filter(author_id=author)

        published = self.request.query_params.get('published')
        if published is not None:
            queryset = queryset.filter(published=published == 'true')

        # Optimize based on action
        if self.action == 'list':
            queryset = queryset.select_related('author').only(
                'id', 'title', 'created_at', 'author__name'
            )
        elif self.action == 'retrieve':
            queryset = queryset.select_related('author').prefetch_related(
                'comments__author', 'tags'
            )

        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return PostListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return PostWriteSerializer
        return PostSerializer

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a post."""
        post = self.get_object()
        post.published = True
        post.published_at = timezone.now()
        post.save()

        serializer = self.get_serializer(post)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """Like a post."""
        post = self.get_object()
        user = request.user

        like, created = Like.objects.get_or_create(post=post, user=user)

        if not created:
            like.delete()
            return Response({'status': 'unliked'})

        return Response({'status': 'liked'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def trending(self, request):
        """Get trending posts."""
        posts = self.get_queryset().annotate(
            like_count=Count('likes')
        ).filter(
            created_at__gte=timezone.now() - timedelta(days=7)
        ).order_by('-like_count')[:10]

        serializer = self.get_serializer(posts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get post statistics."""
        queryset = self.get_queryset()

        stats = {
            'total': queryset.count(),
            'published': queryset.filter(published=True).count(),
            'drafts': queryset.filter(published=False).count(),
            'total_likes': Like.objects.filter(post__in=queryset).count()
        }

        return Response(stats)

    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        """Get comments for a post."""
        post = self.get_object()
        comments = post.comments.select_related('author').all()

        page = self.paginate_queryset(comments)
        if page is not None:
            serializer = CommentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        """Save with current user as author."""
        serializer.save(author=self.request.user)

    def perform_destroy(self, instance):
        """Soft delete instead of hard delete."""
        instance.deleted_at = timezone.now()
        instance.save()
```

## Advanced Permission Patterns

Implement granular permission control.

```python
from rest_framework import permissions

class IsAuthorOrReadOnly(permissions.BasePermission):
    """Object-level permission to only allow authors to edit."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        return obj.author == request.user

class IsPublishedOrAuthor(permissions.BasePermission):
    """Only show published posts unless user is the author."""

    def has_object_permission(self, request, view, obj):
        if obj.published:
            return True

        return obj.author == request.user

class HasAPIKey(permissions.BasePermission):
    """Check for valid API key in header."""

    def has_permission(self, request, view):
        api_key = request.META.get('HTTP_X_API_KEY')
        if not api_key:
            return False

        return APIKey.objects.filter(
            key=api_key,
            is_active=True
        ).exists()

class RateLimitPermission(permissions.BasePermission):
    """Custom rate limiting based on user tier."""

    def has_permission(self, request, view):
        user = request.user

        if not user.is_authenticated:
            return False

        # Check rate limit based on user tier
        if user.tier == 'premium':
            rate = 1000  # requests per day
        else:
            rate = 100

        # Implement rate limiting logic
        cache_key = f'rate_limit_{user.id}'
        current_count = cache.get(cache_key, 0)

        if current_count >= rate:
            return False

        cache.set(cache_key, current_count + 1, timeout=86400)
        return True

# Combine multiple permissions
class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [permissions.IsAuthenticated, IsAuthorOrReadOnly]
        elif self.action == 'list':
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [IsPublishedOrAuthor]

        return [permission() for permission in permission_classes]
```

## Advanced Filtering and Search

Implement sophisticated filtering capabilities.

```python
from django_filters import rest_framework as filters
from rest_framework import filters as drf_filters

class PostFilter(filters.FilterSet):
    # Text filters
    title = filters.CharFilter(lookup_expr='icontains')
    title_exact = filters.CharFilter(field_name='title', lookup_expr='exact')

    # Date range filters
    created_after = filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    # Number range filters
    min_views = filters.NumberFilter(field_name='views', lookup_expr='gte')
    max_views = filters.NumberFilter(field_name='views', lookup_expr='lte')

    # Choice filter
    status = filters.ChoiceFilter(choices=(
        ('published', 'Published'),
        ('draft', 'Draft'),
        ('archived', 'Archived')
    ))

    # Multiple choice filter
    tags = filters.ModelMultipleChoiceFilter(
        queryset=Tag.objects.all(),
        field_name='tags',
        conjoined=False  # OR instead of AND
    )

    # Custom method filter
    has_comments = filters.BooleanFilter(method='filter_has_comments')

    class Meta:
        model = Post
        fields = ['author', 'published', 'category']

    def filter_has_comments(self, queryset, name, value):
        if value:
            return queryset.filter(comments__isnull=False).distinct()
        return queryset.filter(comments__isnull=True)

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    filter_backends = [
        filters.DjangoFilterBackend,
        drf_filters.SearchFilter,
        drf_filters.OrderingFilter
    ]
    filterset_class = PostFilter

    # Search configuration
    search_fields = [
        'title',
        'content',
        'author__name',
        '=author__username',  # Exact match
        '@description',  # Full-text search (PostgreSQL)
    ]

    # Ordering configuration
    ordering_fields = ['created_at', 'updated_at', 'views', 'title']
    ordering = ['-created_at']

# Custom filter backend
class IsOwnerFilterBackend(filters.BaseFilterBackend):
    """Filter objects to show only user's own objects."""

    def filter_queryset(self, request, queryset, view):
        if not request.user.is_authenticated:
            return queryset.none()

        return queryset.filter(author=request.user)

class MyPostViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    filter_backends = [IsOwnerFilterBackend]
```

## Pagination Strategies

Implement various pagination approaches.

```python
from rest_framework.pagination import (
    PageNumberPagination,
    LimitOffsetPagination,
    CursorPagination
)

class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'links': {
                'next': self.get_next_link(),
                'previous': self.get_previous_link()
            },
            'count': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'results': data
        })

class LargeResultsPagination(PageNumberPagination):
    page_size = 1000
    max_page_size = 10000

class SmallResultsPagination(PageNumberPagination):
    page_size = 10

class PostCursorPagination(CursorPagination):
    page_size = 20
    ordering = '-created_at'
    cursor_query_param = 'cursor'

    def get_paginated_response(self, data):
        return Response({
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data
        })

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer

    def get_pagination_class(self):
        if self.action == 'list':
            return StandardPagination
        elif self.action == 'trending':
            return SmallResultsPagination
        return None

    pagination_class = StandardPagination
```

## API Versioning Strategies

Manage API versions effectively.

```python
from rest_framework.versioning import (
    URLPathVersioning,
    NamespaceVersioning,
    AcceptHeaderVersioning,
    QueryParameterVersioning
)

# URL path versioning
class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    versioning_class = URLPathVersioning

    def get_serializer_class(self):
        if self.request.version == 'v1':
            return PostSerializerV1
        elif self.request.version == 'v2':
            return PostSerializerV2
        return PostSerializer

# URLs configuration
urlpatterns = [
    path('v1/posts/', PostViewSet.as_view({'get': 'list'}), name='post-list-v1'),
    path('v2/posts/', PostViewSet.as_view({'get': 'list'}), name='post-list-v2'),
]

# Accept header versioning
REST_FRAMEWORK = {
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.AcceptHeaderVersioning',
    'DEFAULT_VERSION': 'v1',
    'ALLOWED_VERSIONS': ['v1', 'v2', 'v3'],
    'VERSION_PARAM': 'version',
}

# Version-specific serializers
class PostSerializerV1(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['id', 'title', 'content']  # Minimal fields

class PostSerializerV2(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'title', 'content', 'author', 'created_at']

class PostSerializerV3(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = '__all__'
```

## Testing DRF APIs

Write comprehensive tests for your API.

```python
from rest_framework.test import APITestCase, APIClient, APIRequestFactory
from rest_framework import status
from django.contrib.auth.models import User
from django.urls import reverse

class PostAPITestCase(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('testuser', 'test@test.com', 'testpass')
        self.client.force_authenticate(user=self.user)

    def test_create_post(self):
        data = {'title': 'Test Post', 'content': 'Test content'}
        response = self.client.post('/api/posts/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Post.objects.count(), 1)
        self.assertEqual(Post.objects.get().title, 'Test Post')

    def test_list_posts(self):
        Post.objects.create(title='Post 1', author=self.user)
        Post.objects.create(title='Post 2', author=self.user)
        response = self.client.get('/api/posts/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)

    def test_update_post(self):
        post = Post.objects.create(title='Old Title', author=self.user)
        data = {'title': 'New Title'}
        response = self.client.patch(f'/api/posts/{post.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        post.refresh_from_db()
        self.assertEqual(post.title, 'New Title')

    def test_delete_post(self):
        post = Post.objects.create(title='Test', author=self.user)
        response = self.client.delete(f'/api/posts/{post.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Post.objects.count(), 0)

    def test_unauthenticated_access(self):
        self.client.force_authenticate(user=None)
        response = self.client.post('/api/posts/', {})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_permission_denied(self):
        other_user = User.objects.create_user('other', password='pass')
        post = Post.objects.create(title='Test', author=other_user)

        response = self.client.patch(f'/api/posts/{post.id}/', {'title': 'Hacked'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_filtering(self):
        Post.objects.create(title='Python Post', author=self.user, published=True)
        Post.objects.create(title='Django Post', author=self.user, published=False)

        response = self.client.get('/api/posts/?published=true')
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], 'Python Post')

    def test_search(self):
        Post.objects.create(title='Python Tutorial', author=self.user)
        Post.objects.create(title='Django Guide', author=self.user)

        response = self.client.get('/api/posts/?search=Python')
        self.assertEqual(len(response.data['results']), 1)

    def test_ordering(self):
        post1 = Post.objects.create(title='A Post', author=self.user)
        post2 = Post.objects.create(title='Z Post', author=self.user)

        response = self.client.get('/api/posts/?ordering=title')
        self.assertEqual(response.data['results'][0]['title'], 'A Post')

        response = self.client.get('/api/posts/?ordering=-title')
        self.assertEqual(response.data['results'][0]['title'], 'Z Post')

    def test_pagination(self):
        for i in range(25):
            Post.objects.create(title=f'Post {i}', author=self.user)

        response = self.client.get('/api/posts/')
        self.assertEqual(len(response.data['results']), 20)  # Default page size
        self.assertIsNotNone(response.data['next'])

    def test_custom_action(self):
        post = Post.objects.create(title='Test', author=self.user)
        response = self.client.post(f'/api/posts/{post.id}/publish/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        post.refresh_from_db()
        self.assertTrue(post.published)

# Testing with APIRequestFactory
class PostViewSetTestCase(APITestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user('testuser', password='testpass')

    def test_list_action(self):
        request = self.factory.get('/api/posts/')
        request.user = self.user

        view = PostViewSet.as_view({'get': 'list'})
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_action(self):
        data = {'title': 'Test', 'content': 'Content'}
        request = self.factory.post('/api/posts/', data)
        request.user = self.user

        view = PostViewSet.as_view({'post': 'create'})
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
```

## When to Use This Skill

Use django-rest-framework when building modern, production-ready
applications that require
advanced patterns, best practices, and optimal performance.

## Performance Optimization

Optimize DRF API performance for production.

```python
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Optimize based on action
        if self.action == 'list':
            # Minimal fields for list view
            queryset = queryset.select_related('author').only(
                'id', 'title', 'created_at', 'author__name'
            )
        elif self.action == 'retrieve':
            # Full data for detail view
            queryset = queryset.select_related(
                'author', 'category'
            ).prefetch_related(
                'comments__author',
                'tags'
            )

        return queryset

    # Cache list view for 5 minutes
    @method_decorator(cache_page(60 * 5))
    @method_decorator(vary_on_headers('Authorization'))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

# Use only() and defer() in serializers
class PostListSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'title', 'author_name', 'created_at']

class PostDetailSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = '__all__'

# Batch requests
from rest_framework.response import Response
from rest_framework import status

class BatchCreateMixin:
    """Allow batch creation of objects."""

    def create(self, request, *args, **kwargs):
        many = isinstance(request.data, list)

        if not many:
            return super().create(request, *args, **kwargs)

        serializer = self.get_serializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

class PostViewSet(BatchCreateMixin, viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
```

## Documentation and Schema

Generate API documentation automatically.

```python
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from drf_spectacular.types import OpenApiTypes

class PostSerializer(serializers.ModelSerializer):
    """Serializer for Post objects."""

    class Meta:
        model = Post
        fields = ['id', 'title', 'content', 'author', 'created_at']
        read_only_fields = ['id', 'created_at']

class PostViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing posts.

    Provides CRUD operations for posts with additional
    custom actions for publishing and liking.
    """
    queryset = Post.objects.all()
    serializer_class = PostSerializer

    @extend_schema(
        summary="Publish a post",
        description="Set the post's published status to true",
        responses={200: PostSerializer}
    )
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        post = self.get_object()
        post.published = True
        post.save()
        serializer = self.get_serializer(post)
        return Response(serializer.data)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name='author',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='Filter by author ID'
            ),
            OpenApiParameter(
                name='published',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                description='Filter by published status'
            )
        ]
    )
    def list(self, request, *args, **kwargs):
        """List posts with optional filtering."""
        return super().list(request, *args, **kwargs)

# settings.py
REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'My API',
    'DESCRIPTION': 'API for managing posts and comments',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# urls.py
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
```

## DRF Best Practices

1. **Use ModelSerializer** - Leverage ModelSerializer to reduce boilerplate
   code
2. **Validate at serializer level** - Implement validation in serializers, not
   views
3. **Use ViewSets for standard CRUD** - ViewSets reduce code duplication for
   standard operations
4. **Optimize with select_related** - Always optimize queries in
   get_queryset()
5. **Version your API** - Plan for versioning from the start
6. **Use proper permissions** - Implement granular permissions at object level
7. **Implement pagination** - Always paginate list endpoints
8. **Add throttling** - Protect your API with rate limiting
9. **Use filtering backends** - Enable search and filtering for better UX
10. **Write comprehensive tests** - Test all endpoints and permission scenarios
11. **Cache expensive operations** - Use cache decorators for list views
12. **Separate read/write serializers** - Use different serializers for
    different actions
13. **Document your API** - Use drf-spectacular or similar for auto-generated
    docs
14. **Handle errors gracefully** - Provide clear error messages for API
    consumers
15. **Use bulk operations** - Support batch creation/updates for better
    performance

## DRF Common Pitfalls

1. **Not optimizing queries** - N+1 problems in serializers accessing related
   objects
2. **Overly complex serializers** - Too much logic in serializers instead of
   models
3. **Missing validation** - Not validating data at both field and object level
4. **Inconsistent API design** - Not following REST conventions
5. **No pagination** - Returning unbounded lists causes performance issues
6. **Weak authentication** - Not implementing proper token expiration or
   refresh
7. **Missing permissions** - Not implementing object-level permissions
8. **No API versioning** - Breaking changes affect existing clients
9. **Poor error messages** - Generic errors that don't help API consumers
10. **Inadequate testing** - Not testing permissions, edge cases, and error
    scenarios
11. **Exposing sensitive data** - Returning password hashes or internal IDs
12. **Not using read_only_fields** - Allowing modification of computed fields
13. **Ignoring CORS** - Not configuring CORS for frontend applications
14. **Missing rate limiting** - APIs vulnerable to abuse without throttling
15. **Not handling file uploads** - Improper handling of multipart/form-data
    requests

## Resources

- [Django REST Framework Documentation](https://www.django-rest-framework.org/)
- [DRF Serializers Guide](https://www.django-rest-framework.org/api-guide/serializers/)
- [DRF ViewSets](https://www.django-rest-framework.org/api-guide/viewsets/)
- [DRF Authentication](https://www.django-rest-framework.org/api-guide/authentication/)
- [DRF Testing](https://www.django-rest-framework.org/api-guide/testing/)

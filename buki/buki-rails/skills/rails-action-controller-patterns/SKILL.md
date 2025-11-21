---
name: rails-action-controller-patterns
description: Use when action Controller patterns including routing, filters, strong parameters, and REST conventions.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# Rails Action Controller Patterns

Master Action Controller patterns for building robust Rails controllers with
proper routing, filters, parameter handling, and RESTful design.

## Overview

Action Controller is the component that handles web requests in Rails. It
processes incoming requests, interacts with models, and renders responses.
Controllers follow the MVC pattern and implement REST conventions by default.

## Installation and Setup

### Generating Controllers

```bash
# Generate a resource controller
rails generate controller Posts index show new create edit update destroy

# Generate a namespaced controller
rails generate controller Admin::Posts index show

# Generate an API-only controller
rails generate controller Api::V1::Posts --no-helper --no-assets
```

### Routing Configuration

```ruby
# config/routes.rb
Rails.application.routes.draw do
  # RESTful resources
  resources :posts

  # Nested resources
  resources :posts do
    resources :comments
  end

  # Namespaced routes
  namespace :admin do
    resources :posts
  end

  # Custom routes
  get 'about', to: 'pages#about'
  root 'posts#index'
end
```

## Core Patterns

### 1. Basic Controller Structure

```ruby
# app/controllers/posts_controller.rb
class PostsController < ApplicationController
  before_action :authenticate_user!, except: [:index, :show]
  before_action :set_post, only: [:show, :edit, :update, :destroy]
  before_action :authorize_post, only: [:edit, :update, :destroy]

  # GET /posts
  def index
    @posts = Post.includes(:user)
                 .order(created_at: :desc)
                 .page(params[:page])
  end

  # GET /posts/:id
  def show
    @comments = @post.comments.includes(:user)
  end

  # GET /posts/new
  def new
    @post = Post.new
  end

  # POST /posts
  def create
    @post = current_user.posts.build(post_params)

    if @post.save
      redirect_to @post, notice: 'Post was successfully created.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  # GET /posts/:id/edit
  def edit
  end

  # PATCH/PUT /posts/:id
  def update
    if @post.update(post_params)
      redirect_to @post, notice: 'Post was successfully updated.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  # DELETE /posts/:id
  def destroy
    @post.destroy
    redirect_to posts_url, notice: 'Post was successfully deleted.'
  end

  private

  def set_post
    @post = Post.find(params[:id])
  end

  def authorize_post
    unless @post.user == current_user
      redirect_to posts_path, alert: 'Not authorized'
    end
  end

  def post_params
    params.require(:post).permit(:title, :body, :status, tag_ids: [])
  end
end
```

### 2. Strong Parameters

```ruby
# app/controllers/users_controller.rb
class UsersController < ApplicationController
  # Basic strong parameters
  def user_params
    params.require(:user).permit(:name, :email, :password)
  end

  # Nested attributes
  def user_params_with_profile
    params.require(:user).permit(
      :name, :email,
      profile_attributes: [:bio, :avatar, :website]
    )
  end

  # Arrays of permitted attributes
  def post_params
    params.require(:post).permit(
      :title, :body,
      tag_ids: [],
      images: []
    )
  end

  # Conditional parameters
  def user_params
    permitted = [:name, :email]
    permitted << :admin if current_user.admin?
    params.require(:user).permit(*permitted)
  end

  # Deep nested attributes
  def organization_params
    params.require(:organization).permit(
      :name,
      departments_attributes: [
        :id, :name, :_destroy,
        employees_attributes: [:id, :name, :role, :_destroy]
      ]
    )
  end

  # JSON parameters
  def config_params
    params.require(:config).permit(
      settings: [:theme, :notifications, :language],
      preferences: {}
    )
  end
end
```

### 3. Filters and Callbacks

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  # Before filters
  before_action :authenticate_user!
  before_action :configure_permitted_parameters, if: :devise_controller?
  before_action :set_time_zone, if: :user_signed_in?

  # After filters
  after_action :log_activity
  after_action :set_cache_headers

  # Around filters
  around_action :measure_action_time

  private

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: [:name])
  end

  def set_time_zone
    Time.zone = current_user.time_zone
  end

  def log_activity
    ActivityLogger.log(controller_name, action_name, current_user)
  end

  def set_cache_headers
    response.headers['Cache-Control'] = 'no-cache, no-store'
  end

  def measure_action_time
    start = Time.current
    yield
    duration = Time.current - start
    Rails.logger.info "Action took #{duration}s"
  end
end

# app/controllers/posts_controller.rb
class PostsController < ApplicationController
  skip_before_action :authenticate_user!, only: [:index, :show]
  before_action :set_post, only: [:show, :edit, :update]
  before_action :verify_ownership, only: [:edit, :update]

  prepend_before_action :load_categories
  append_before_action :track_view, only: [:show]

  private

  def verify_ownership
    redirect_to root_path unless @post.user == current_user
  end

  def load_categories
    @categories = Category.all
  end

  def track_view
    @post.increment!(:views_count)
  end
end
```

### 4. RESTful Conventions

```ruby
# config/routes.rb
Rails.application.routes.draw do
  resources :posts do
    # Collection routes (no ID)
    collection do
      get :drafts
      get :search
    end

    # Member routes (with ID)
    member do
      post :publish
      patch :archive
    end

    # Nested resources
    resources :comments, only: [:create, :destroy]
  end

  # Shallow nesting
  resources :authors do
    resources :books, shallow: true
  end

  # Only/except options
  resources :users, only: [:index, :show]
  resources :sessions, except: [:edit, :update]

  # Custom resource names
  resources :posts, path: 'articles'
end

# app/controllers/posts_controller.rb
class PostsController < ApplicationController
  # GET /posts/drafts
  def drafts
    @posts = current_user.posts.draft
    render :index
  end

  # GET /posts/search
  def search
    @posts = Post.search(params[:q])
    render :index
  end

  # POST /posts/:id/publish
  def publish
    @post = Post.find(params[:id])
    if @post.publish!
      redirect_to @post, notice: 'Post published'
    else
      redirect_to @post, alert: 'Could not publish post'
    end
  end
end
```

### 5. Rendering Responses

```ruby
# app/controllers/posts_controller.rb
class PostsController < ApplicationController
  def show
    @post = Post.find(params[:id])

    respond_to do |format|
      format.html # Renders show.html.erb by default
      format.json { render json: @post }
      format.xml { render xml: @post }
      format.pdf { render pdf: @post }
    end
  end

  def create
    @post = Post.new(post_params)

    if @post.save
      # Redirect to a URL
      redirect_to @post, notice: 'Created'

      # Redirect back with fallback
      redirect_back fallback_location: root_path, notice: 'Created'
    else
      # Render a template with status
      render :new, status: :unprocessable_entity
    end
  end

  def export
    # Render text
    render plain: 'Export complete'

    # Render JSON with status
    render json: { status: 'ok' }, status: :ok

    # Render nothing
    head :no_content

    # Render file
    send_file '/path/to/file.pdf',
      filename: 'document.pdf',
      type: 'application/pdf',
      disposition: 'attachment'

    # Stream file
    send_data generate_csv, filename: 'report.csv',
      type: 'text/csv',
      disposition: 'inline'
  end

  def partial_update
    # Render partial
    render partial: 'post', locals: { post: @post }

    # Render collection
    render partial: 'post', collection: @posts

    # Render with layout
    render 'special_layout', layout: 'admin'

    # Render without layout
    render layout: false
  end
end
```

### 6. Error Handling

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  rescue_from ActiveRecord::RecordNotFound, with: :not_found
  rescue_from ActiveRecord::RecordInvalid, with: :unprocessable_entity
  rescue_from ActionController::ParameterMissing, with: :bad_request
  rescue_from Pundit::NotAuthorizedError, with: :forbidden

  private

  def not_found(exception)
    respond_to do |format|
      format.html { render 'errors/404', status: :not_found }
      format.json { render json: { error: exception.message },
                           status: :not_found }
    end
  end

  def unprocessable_entity(exception)
    render json: { errors: exception.record.errors },
           status: :unprocessable_entity
  end

  def bad_request(exception)
    render json: { error: exception.message },
           status: :bad_request
  end

  def forbidden
    respond_to do |format|
      format.html { render 'errors/403', status: :forbidden }
      format.json { render json: { error: 'Forbidden' },
                           status: :forbidden }
    end
  end
end
```

### 7. Session and Cookie Management

```ruby
# app/controllers/sessions_controller.rb
class SessionsController < ApplicationController
  def create
    user = User.find_by(email: params[:email])

    if user&.authenticate(params[:password])
      # Set session
      session[:user_id] = user.id

      # Set signed cookie
      cookies.signed[:user_id] = user.id

      # Set encrypted cookie
      cookies.encrypted[:user_token] = user.token

      # Set permanent cookie (20 years)
      cookies.permanent[:remember_token] = user.remember_token

      # Set cookie with options
      cookies[:preference] = {
        value: 'dark_mode',
        expires: 1.year.from_now,
        domain: '.example.com',
        secure: Rails.env.production?,
        httponly: true
      }

      redirect_to root_path
    else
      flash.now[:alert] = 'Invalid credentials'
      render :new
    end
  end

  def destroy
    # Clear session
    session.delete(:user_id)
    reset_session

    # Clear cookies
    cookies.delete(:user_id)
    cookies.delete(:remember_token)

    redirect_to login_path
  end
end

# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  private

  def current_user
    @current_user ||= User.find_by(id: session[:user_id])
  end

  def user_signed_in?
    current_user.present?
  end

  helper_method :current_user, :user_signed_in?
end
```

### 8. Flash Messages

```ruby
# app/controllers/posts_controller.rb
class PostsController < ApplicationController
  def create
    @post = Post.new(post_params)

    if @post.save
      # Standard flash
      flash[:notice] = 'Post created'
      redirect_to @post

      # Flash with redirect
      redirect_to @post, notice: 'Post created'

      # Multiple flash types
      flash[:success] = 'Operation succeeded'
      flash[:error] = 'Something went wrong'
      flash[:warning] = 'Be careful'
      flash[:info] = 'FYI'

      # Flash.now for render (not redirect)
      flash.now[:alert] = 'Validation failed'
      render :new
    end
  end

  def update
    if @post.update(post_params)
      # Flash with custom key
      flash[:custom_message] = 'Custom notification'
      redirect_to @post
    else
      # Keep flash for next request
      flash.keep
      redirect_to edit_post_path(@post)
    end
  end
end

# app/views/layouts/application.html.erb
<%# Display all flash messages %>
<% flash.each do |type, message| %>
  <div class="flash <%= type %>">
    <%= message %>
  </div>
<% end %>
```

### 9. API Controllers

```ruby
# app/controllers/api/v1/base_controller.rb
module Api
  module V1
    class BaseController < ActionController::API
      include ActionController::HttpAuthentication::Token::ControllerMethods

      before_action :authenticate

      rescue_from ActiveRecord::RecordNotFound do |e|
        render json: { error: e.message }, status: :not_found
      end

      private

      def authenticate
        authenticate_or_request_with_http_token do |token, options|
          @current_user = User.find_by(api_token: token)
        end
      end

      def current_user
        @current_user
      end
    end
  end
end

# app/controllers/api/v1/posts_controller.rb
module Api
  module V1
    class PostsController < BaseController
      def index
        @posts = Post.page(params[:page]).per(20)

        render json: @posts,
               meta: pagination_meta(@posts),
               status: :ok
      end

      def show
        @post = Post.find(params[:id])
        render json: @post, status: :ok
      end

      def create
        @post = current_user.posts.build(post_params)

        if @post.save
          render json: @post, status: :created, location: api_v1_post_url(@post)
        else
          render json: { errors: @post.errors },
                 status: :unprocessable_entity
        end
      end

      def update
        @post = current_user.posts.find(params[:id])

        if @post.update(post_params)
          render json: @post, status: :ok
        else
          render json: { errors: @post.errors },
                 status: :unprocessable_entity
        end
      end

      def destroy
        @post = current_user.posts.find(params[:id])
        @post.destroy
        head :no_content
      end

      private

      def post_params
        params.require(:post).permit(:title, :body, :status)
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages: collection.total_pages,
          total_count: collection.total_count
        }
      end
    end
  end
end
```

### 10. Streaming Responses

```ruby
# app/controllers/reports_controller.rb
class ReportsController < ApplicationController
  include ActionController::Live

  def export
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] =
      'attachment; filename="report.csv"'

    # Stream CSV data
    User.find_each do |user|
      response.stream.write "#{user.id},#{user.name},#{user.email}\n"
    end
  ensure
    response.stream.close
  end

  def events
    # Server-sent events
    response.headers['Content-Type'] = 'text/event-stream'
    response.headers['Cache-Control'] = 'no-cache'

    10.times do |i|
      response.stream.write "data: #{i}\n\n"
      sleep 1
    end
  ensure
    response.stream.close
  end
end
```

## Best Practices

1. **Follow REST conventions** - Use standard CRUD actions when possible
2. **Keep controllers thin** - Move business logic to models/services
3. **Use strong parameters** - Always sanitize input parameters
4. **Handle errors gracefully** - Implement proper error handling
5. **Use before_action** - DRY up common operations with filters
6. **Return proper status codes** - Use semantic HTTP status codes
7. **Implement proper authentication** - Secure your controllers
8. **Use respond_to for multiple formats** - Support HTML, JSON, etc.
9. **Leverage flash messages** - Provide user feedback
10. **Version your APIs** - Use namespacing for API versions

## Common Pitfalls

1. **Fat controllers** - Putting too much logic in controllers
2. **Missing CSRF protection** - Not using authenticity tokens
3. **Weak parameters** - Permitting too many or wrong parameters
4. **No error handling** - Not rescuing exceptions
5. **Missing authorization** - Not checking user permissions
6. **Inconsistent responses** - Different status codes for same scenarios
7. **Session bloat** - Storing too much data in session
8. **Missing before_action** - Duplicating code across actions
9. **Incorrect redirects** - Redirecting when rendering is needed
10. **No rate limiting** - APIs without throttling

## When to Use

- Building web applications with Rails
- Creating RESTful APIs
- Implementing MVC pattern
- Handling HTTP requests and responses
- Building admin interfaces
- Creating CRUD interfaces
- Implementing authentication flows
- Building multi-tenant applications
- Creating webhooks and callbacks
- Developing content management systems

## Resources

- [Action Controller Overview](https://guides.rubyonrails.org/action_controller_overview.html)
- [Rails Routing Guide](https://guides.rubyonrails.org/routing.html)
- [Strong Parameters](https://api.rubyonrails.org/classes/ActionController/StrongParameters.html)
- [Rails API Documentation](https://api.rubyonrails.org/)
- [RESTful Web Services](https://www.oreilly.com/library/view/restful-web-services/9780596529260/)

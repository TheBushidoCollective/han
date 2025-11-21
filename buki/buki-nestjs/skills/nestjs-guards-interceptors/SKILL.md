---
name: nestjs-guards-interceptors
description: Use when nestJS guards and interceptors for auth, logging, and transformation. Use when implementing cross-cutting concerns.
allowed-tools:
  - Bash
  - Read
---

# NestJS Guards and Interceptors

Master NestJS guards and interceptors for implementing authentication,
authorization, logging, and request/response transformation.

## Guards Fundamentals

Understanding CanActivate and ExecutionContext.

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class BasicGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }

  private validateRequest(request: any): boolean {
    // Simple validation logic
    return !!request.headers.authorization;
  }
}

// ExecutionContext provides context about current request
@Injectable()
export class ContextAwareGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Get HTTP context
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    // Get handler and class information
    const handler = context.getHandler();
    const controller = context.getClass();

    console.log(`Handler: ${handler.name}`);
    console.log(`Controller: ${controller.name}`);

    return true;
  }
}

// Usage in controller
import { Controller, Get, UseGuards } from '@nestjs/common';

@Controller('users')
@UseGuards(BasicGuard)
export class UserController {
  @Get()
  findAll() {
    return [];
  }

  @Get('profile')
  @UseGuards(ContextAwareGuard)  // Method-level guard
  getProfile() {
    return { name: 'John' };
  }
}
```

## Authentication Guards

JWT, session, and API key authentication patterns.

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      // Attach user to request
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

// Session-based authentication
@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.session || !request.session.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    return true;
  }
}

// API Key authentication
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }

    const validApiKey = this.configService.get('API_KEY');
    if (apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}

// Multiple auth strategies
@Injectable()
export class MultiAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try JWT first
    const token = this.extractTokenFromHeader(request);
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        request['user'] = payload;
        return true;
      } catch {}
    }

    // Fall back to API key
    const apiKey = request.headers['x-api-key'];
    if (apiKey === this.configService.get('API_KEY')) {
      return true;
    }

    throw new UnauthorizedException();
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

## Role-Based Authorization Guards

RBAC patterns with decorators.

```typescript
import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Define roles
export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

// Roles decorator
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// Roles guard
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;  // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const hasRole = requiredRoles.some((role) => user.roles?.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

// Usage
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('users')
  @Roles(Role.ADMIN)
  getAllUsers() {
    return [];
  }

  @Get('moderate')
  @Roles(Role.ADMIN, Role.MODERATOR)
  moderateContent() {
    return { message: 'Moderation tools' };
  }
}

// Permission-based authorization
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const hasPermission = requiredPermissions.every((permission) =>
      user.permissions?.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Missing required permissions');
    }

    return true;
  }
}

// Resource ownership guard
@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceId = request.params.id;

    const resource = await this.usersService.findOne(resourceId);

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (resource.userId !== user.id && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('You do not own this resource');
    }

    // Attach resource to request for later use
    request['resource'] = resource;
    return true;
  }
}
```

## Interceptors Fundamentals

NestInterceptor and response transformation.

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

// Basic interceptor
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('Before...');

    const now = Date.now();
    return next
      .handle()
      .pipe(tap(() => console.log(`After... ${Date.now() - now}ms`)));
  }
}

// Transform response
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        timestamp: new Date().toISOString(),
        path: context.switchToHttp().getRequest().url,
      })),
    );
  }
}

interface Response<T> {
  data: T;
  timestamp: string;
  path: string;
}

// Error handling in interceptor
@Injectable()
export class ErrorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        console.error('Error caught in interceptor:', err);
        throw new InternalServerErrorException('Something went wrong');
      }),
    );
  }
}

// Usage
@Controller('users')
@UseInterceptors(LoggingInterceptor)
export class UserController {
  @Get()
  @UseInterceptors(TransformInterceptor)
  findAll() {
    return [{ id: 1, name: 'John' }];
  }
}
```

## Logging Interceptors

Advanced logging patterns.

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const userAgent = request.get('user-agent') || '';

    this.logger.log(`Incoming Request: ${method} ${url}`);
    this.logger.debug(`User Agent: ${userAgent}`);
    this.logger.debug(`Body: ${JSON.stringify(body)}`);

    const now = Date.now();
    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          this.logger.log(
            `Response: ${method} ${url} ${response.statusCode} - ${Date.now() - now}ms`,
          );
        },
        error: (err) => {
          this.logger.error(
            `Error: ${method} ${url} - ${err.message}`,
            err.stack,
          );
        },
      }),
    );
  }
}

// Performance monitoring
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        if (duration > 1000) {
          this.logger.warn(`Slow request: ${method} ${url} - ${duration}ms`);
        } else {
          this.logger.log(`${method} ${url} - ${duration}ms`);
        }
      }),
    );
  }
}
```

## Response Transformation Interceptors

Shaping API responses consistently.

```typescript
// Wrap all responses
@Injectable()
export class ResponseWrapperInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        return {
          statusCode: response.statusCode,
          message: 'Success',
          data,
        };
      }),
    );
  }
}

// Pagination wrapper
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'items' in data) {
          const { items, total } = data;
          const request = context.switchToHttp().getRequest();
          const page = parseInt(request.query.page) || 1;
          const pageSize = parseInt(request.query.pageSize) || 10;

          return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          };
        }
        return data;
      }),
    );
  }
}

// Exclude null fields
@Injectable()
export class ExcludeNullInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        return this.removeNullValues(data);
      }),
    );
  }

  private removeNullValues(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeNullValues(item));
    }

    if (obj !== null && typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value !== null) {
          acc[key] = this.removeNullValues(value);
        }
        return acc;
      }, {});
    }

    return obj;
  }
}
```

## Caching Interceptors

Implementing caching strategies.

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = `${request.method}:${request.url}`;

    // Check cache
    const cachedResponse = await this.cacheManager.get(cacheKey);
    if (cachedResponse) {
      return of(cachedResponse);
    }

    // Execute handler and cache result
    return next.handle().pipe(
      tap(async (response) => {
        await this.cacheManager.set(cacheKey, response, 60000); // 60s TTL
      }),
    );
  }
}

// Conditional caching
export const CACHE_KEY_METADATA = 'cache_key';
export const CacheKey = (key: string) => SetMetadata(CACHE_KEY_METADATA, key);

@Injectable()
export class SmartCacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const cacheKey = this.reflector.get(CACHE_KEY_METADATA, context.getHandler());

    if (!cacheKey) {
      return next.handle();
    }

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    return next.handle().pipe(
      tap(async (response) => {
        await this.cacheManager.set(cacheKey, response);
      }),
    );
  }
}

// Usage
@Controller('products')
export class ProductsController {
  @Get()
  @CacheKey('all-products')
  findAll() {
    return this.productsService.findAll();
  }
}
```

## Timeout Interceptors

Handling request timeouts.

```typescript
import { timeout, catchError } from 'rxjs/operators';
import { throwError, TimeoutError } from 'rxjs';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000), // 5 second timeout
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}

// Dynamic timeout based on endpoint
export const TIMEOUT_METADATA = 'timeout';
export const Timeout = (milliseconds: number) =>
  SetMetadata(TIMEOUT_METADATA, milliseconds);

@Injectable()
export class DynamicTimeoutInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const timeoutValue =
      this.reflector.get(TIMEOUT_METADATA, context.getHandler()) || 5000;

    return next.handle().pipe(
      timeout(timeoutValue),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}

// Usage
@Controller('reports')
export class ReportsController {
  @Get('generate')
  @Timeout(30000)  // 30 second timeout for long-running report
  generateReport() {
    return this.reportsService.generate();
  }
}
```

## Pipes

Validation and transformation pipes.

```typescript
import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

// Built-in validation pipe
import { ValidationPipe } from '@nestjs/common';

@Controller('users')
export class UserController {
  @Post()
  create(@Body(new ValidationPipe()) createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}

// Custom validation pipe
@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      const messages = errors.map((err) => ({
        property: err.property,
        constraints: err.constraints,
      }));
      throw new BadRequestException({ errors: messages });
    }

    return value;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}

// Transformation pipes
@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const val = parseInt(value, 10);
    if (isNaN(val)) {
      throw new BadRequestException('Validation failed (numeric string expected)');
    }
    return val;
  }
}

// Built-in pipes usage
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.usersService.findOne(id);
}

// Strip fields pipe
@Injectable()
export class StripFieldsPipe implements PipeTransform {
  constructor(private readonly fieldsToStrip: string[]) {}

  transform(value: any) {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    const result = { ...value };
    this.fieldsToStrip.forEach((field) => {
      delete result[field];
    });

    return result;
  }
}

// Default value pipe
@Injectable()
export class DefaultValuePipe implements PipeTransform {
  constructor(private readonly defaultValue: any) {}

  transform(value: any) {
    return value !== undefined && value !== null ? value : this.defaultValue;
  }
}
```

## Exception Filters

Custom exception handling.

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

// HTTP exception filter
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception.message,
    });
  }
}

// All exceptions filter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : 'Unknown error',
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}

// Validation exception filter
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const exceptionResponse = exception.getResponse();
    const errors =
      typeof exceptionResponse === 'object' && 'message' in exceptionResponse
        ? exceptionResponse['message']
        : exceptionResponse;

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: new Date().toISOString(),
      path: request.url,
      errors,
    });
  }
}

// Usage
@Controller('users')
@UseFilters(new HttpExceptionFilter())
export class UserController {}

// Global filter
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3000);
}
```

## Middleware

Function and class middleware.

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Class middleware
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;

      this.logger.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);
    });

    next();
  }
}

// Function middleware
export function logger(req: Request, res: Response, next: NextFunction) {
  console.log(`Request: ${req.method} ${req.url}`);
  next();
}

// Authentication middleware
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const user = await this.authService.validateToken(token);
      req['user'] = user;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

// CORS middleware
@Injectable()
export class CorsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  }
}

// Apply middleware in module
import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [UserController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');

    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'health', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
```

## Request Lifecycle and Execution Order

Understanding the order of execution.

```typescript
// Order of execution:
// 1. Middleware
// 2. Guards
// 3. Interceptors (before)
// 4. Pipes
// 5. Controller method
// 6. Interceptors (after)
// 7. Exception filters

@Controller('demo')
export class DemoController {
  private readonly logger = new Logger(DemoController.name);

  @Post()
  @UseGuards(DemoGuard)
  @UseInterceptors(DemoInterceptor)
  @UsePipes(DemoPipe)
  create(@Body() data: any) {
    this.logger.log('5. Controller method executed');
    return data;
  }
}

@Injectable()
export class DemoGuard implements CanActivate {
  private readonly logger = new Logger(DemoGuard.name);

  canActivate(context: ExecutionContext): boolean {
    this.logger.log('2. Guard executed');
    return true;
  }
}

@Injectable()
export class DemoInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DemoInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    this.logger.log('3. Interceptor before');
    return next.handle().pipe(
      tap(() => this.logger.log('6. Interceptor after')),
    );
  }
}

@Injectable()
export class DemoPipe implements PipeTransform {
  private readonly logger = new Logger(DemoPipe.name);

  transform(value: any) {
    this.logger.log('4. Pipe executed');
    return value;
  }
}
```

## Testing Guards and Interceptors

Unit testing patterns.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should allow valid token', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer valid-token' },
        }),
      }),
    } as ExecutionContext;

    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ userId: 1 });

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should reject invalid token', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer invalid-token' },
        }),
      }),
    } as ExecutionContext;

    jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(new Error());

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should transform response', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/test' }),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ name: 'Test' }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('path');
      expect(result.data).toEqual({ name: 'Test' });
      done();
    });
  });
});
```

## When to Use This Skill

Use nestjs-guards-interceptors when:

- Implementing authentication and authorization
- Adding logging and monitoring to your application
- Transforming request/response data consistently
- Implementing caching strategies
- Adding timeouts to requests
- Handling cross-cutting concerns
- Building middleware for request processing
- Creating reusable validation logic
- Implementing RBAC or ABAC patterns
- Adding performance monitoring

## NestJS Guards and Interceptors Best Practices

1. **Single responsibility** - Each guard/interceptor should have one clear purpose
2. **Use metadata** - Leverage decorators and Reflector for configuration
3. **Chain appropriately** - Understand execution order when combining
   multiple guards/interceptors
4. **Error handling** - Always handle errors gracefully in guards and interceptors
5. **Async operations** - Use async/await for database calls in guards
6. **Global vs local** - Apply guards/interceptors at appropriate scope
   (global, controller, method)
7. **Test thoroughly** - Write unit tests for all guards and interceptors
8. **Performance** - Keep guards and interceptors lightweight
9. **Logging** - Use Logger service instead of console.log
10. **Type safety** - Use TypeScript generics for type-safe interceptors

## NestJS Guards and Interceptors Common Pitfalls

1. **Wrong execution order** - Not understanding middleware → guards →
   interceptors → pipes flow
2. **Forgetting async** - Not using async when guards perform database operations
3. **Missing error handling** - Guards that don't throw appropriate exceptions
4. **Interceptor mutation** - Mutating data in interceptors instead of transforming
5. **Circular dependencies** - Guards that create circular dependency chains
6. **Global scope issues** - Applying too many global guards/interceptors hurts performance
7. **Missing metadata** - Forgetting to use Reflector to read custom metadata
8. **Pipe placement** - Using pipes in wrong order with validation
9. **Exception filter scope** - Not understanding filter precedence
10. **Memory leaks** - Not properly cleaning up subscriptions in interceptors

## Resources

- [NestJS Guards Documentation](https://docs.nestjs.com/guards)
- [NestJS Interceptors Documentation](https://docs.nestjs.com/interceptors)
- [NestJS Pipes Documentation](https://docs.nestjs.com/pipes)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [NestJS Middleware Documentation](https://docs.nestjs.com/middleware)
- [NestJS Execution Context](https://docs.nestjs.com/fundamentals/execution-context)
- [RxJS Operators Guide](https://rxjs.dev/guide/operators)
- [NestJS Custom Decorators](https://docs.nestjs.com/custom-decorators)

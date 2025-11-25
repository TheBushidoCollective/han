---
name: docker-compose-networking
description: Use when configuring networks and service communication in Docker Compose including bridge networks, overlay networks, service discovery, and inter-service communication.
allowed-tools: [Bash, Read]
---

# Docker Compose Networking

Master network configuration and service communication patterns in Docker Compose for building secure, scalable multi-container applications.

## Default Bridge Network

Docker Compose automatically creates a default bridge network for all services in a compose file:

```yaml
version: '3.8'

services:
  frontend:
    image: nginx:alpine
    ports:
      - "80:80"
    # Can reach backend using service name as hostname

  backend:
    image: node:18-alpine
    command: node server.js
    # Accessible at hostname 'backend' from frontend

  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: secret
    # Accessible at hostname 'database' from backend
```

In this setup:

- All services can communicate using service names as hostnames
- Frontend can reach backend at `http://backend:3000`
- Backend can reach database at `postgres://database:5432`
- Only frontend's port 80 is exposed to host

## Custom Bridge Networks

Define custom networks for service isolation and segmentation:

```yaml
version: '3.8'

services:
  frontend:
    image: nginx:alpine
    networks:
      - frontend-network
    ports:
      - "80:80"

  api:
    image: node:18-alpine
    networks:
      - frontend-network
      - backend-network
    environment:
      DATABASE_URL: postgresql://db:5432/app

  database:
    image: postgres:15-alpine
    networks:
      - backend-network
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: app
    volumes:
      - db-data:/var/lib/postgresql/data

  cache:
    image: redis:7-alpine
    networks:
      - backend-network
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

networks:
  frontend-network:
    driver: bridge
  backend-network:
    driver: bridge
    internal: true

volumes:
  db-data:
  redis-data:
```

Network isolation:

- Frontend can only reach API
- Frontend cannot reach database or cache directly
- API can reach all services
- Backend network is internal (no external access)

## Network Aliases

Configure multiple hostnames for service discovery:

```yaml
version: '3.8'

services:
  web:
    image: nginx:alpine
    networks:
      public:
        aliases:
          - website
          - www
          - web-server
      internal:
        aliases:
          - web-internal

  api:
    image: node:18-alpine
    networks:
      public:
        aliases:
          - api-server
          - backend
      internal:
        aliases:
          - api-internal
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    networks:
      internal:
        aliases:
          - db
          - postgres
          - primary-db
    environment:
      POSTGRES_PASSWORD: secret

networks:
  public:
    driver: bridge
  internal:
    driver: bridge
    internal: true
```

Services can be reached by any of their aliases:

- `http://website`, `http://www`, `http://web-server` all reach web service
- `postgresql://db:5432`, `postgresql://postgres:5432` both reach database

## Static IP Addresses

Assign fixed IP addresses for services requiring stable networking:

```yaml
version: '3.8'

services:
  loadbalancer:
    image: nginx:alpine
    networks:
      app-network:
        ipv4_address: 172.28.1.10
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro

  app-1:
    image: myapp:latest
    networks:
      app-network:
        ipv4_address: 172.28.1.11
    environment:
      APP_ID: "1"

  app-2:
    image: myapp:latest
    networks:
      app-network:
        ipv4_address: 172.28.1.12
    environment:
      APP_ID: "2"

  app-3:
    image: myapp:latest
    networks:
      app-network:
        ipv4_address: 172.28.1.13
    environment:
      APP_ID: "3"

  database:
    image: postgres:15-alpine
    networks:
      app-network:
        ipv4_address: 172.28.1.20
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

networks:
  app-network:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.28.0.0/16
          gateway: 172.28.1.1

volumes:
  pgdata:
```

## External Networks

Connect to existing Docker networks created outside Compose:

```yaml
version: '3.8'

services:
  api:
    image: node:18-alpine
    networks:
      - app-network
      - shared-network
    environment:
      DATABASE_URL: postgresql://db:5432/app

  database:
    image: postgres:15-alpine
    networks:
      - app-network
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

networks:
  app-network:
    driver: bridge

  shared-network:
    external: true
    name: company-shared-network

volumes:
  pgdata:
```

Create external network first:

```bash
docker network create company-shared-network
docker compose up -d
```

## Host Network Mode

Use host networking for maximum performance (Linux only):

```yaml
version: '3.8'

services:
  high-performance-app:
    image: myapp:latest
    network_mode: "host"
    environment:
      BIND_ADDRESS: "0.0.0.0"
      PORT: "8080"
    # No port mapping needed - directly uses host's network stack

  monitoring:
    image: prometheus:latest
    network_mode: "host"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.listen-address=0.0.0.0:9090'

volumes:
  prometheus-data:
```

Note: Host networking bypasses Docker network isolation and is typically used for monitoring tools or high-throughput applications.

## Service Discovery and DNS

Configure DNS resolution and service discovery:

```yaml
version: '3.8'

services:
  api:
    image: node:18-alpine
    networks:
      - app-network
    dns:
      - 8.8.8.8
      - 8.8.4.4
    dns_search:
      - company.local
    extra_hosts:
      - "legacy-api.company.local:192.168.1.100"
      - "auth-service.company.local:192.168.1.101"
    environment:
      DATABASE_HOST: database.company.local

  database:
    image: postgres:15-alpine
    networks:
      app-network:
        aliases:
          - database.company.local
          - db.company.local
    hostname: primary-database
    domainname: company.local
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

networks:
  app-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-company-app

volumes:
  pgdata:
```

## Link Containers (Legacy)

While `links` is deprecated, understanding it helps migrate legacy configurations:

```yaml
version: '3.8'

services:
  # Modern approach - use networks instead
  web:
    image: nginx:alpine
    networks:
      - app-network
    depends_on:
      - api

  api:
    image: node:18-alpine
    networks:
      - app-network
    depends_on:
      - database
    environment:
      # Use service name as hostname
      DATABASE_URL: postgresql://database:5432/app

  database:
    image: postgres:15-alpine
    networks:
      - app-network
    environment:
      POSTGRES_PASSWORD: secret

networks:
  app-network:
    driver: bridge
```

## Multi-Network Architecture

Complex applications with multiple isolated networks:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    networks:
      - public
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - api

  frontend:
    image: react-app:latest
    networks:
      - public
      - frontend-tier
    environment:
      API_URL: http://api:3000

  api:
    image: node-api:latest
    networks:
      - frontend-tier
      - backend-tier
    environment:
      DATABASE_URL: postgresql://postgres:5432/app
      REDIS_URL: redis://cache:6379
      QUEUE_URL: amqp://rabbitmq:5672
    depends_on:
      - database
      - cache
      - queue

  worker:
    image: node-worker:latest
    networks:
      - backend-tier
    environment:
      DATABASE_URL: postgresql://postgres:5432/app
      QUEUE_URL: amqp://rabbitmq:5672
    depends_on:
      - database
      - queue
    deploy:
      replicas: 3

  database:
    image: postgres:15-alpine
    networks:
      - backend-tier
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data

  cache:
    image: redis:7-alpine
    networks:
      - backend-tier
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

  queue:
    image: rabbitmq:3-management-alpine
    networks:
      - backend-tier
      - management
    ports:
      - "15672:15672"  # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: secret
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq

  monitoring:
    image: prometheus:latest
    networks:
      - management
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus

networks:
  public:
    driver: bridge
  frontend-tier:
    driver: bridge
    internal: true
  backend-tier:
    driver: bridge
    internal: true
  management:
    driver: bridge

volumes:
  pgdata:
  redis-data:
  rabbitmq-data:
  prometheus-data:
```

Network segmentation:

- Public: Internet-facing services (nginx, frontend)
- Frontend-tier: Frontend and API communication
- Backend-tier: API, workers, databases, cache, queue
- Management: Monitoring and administration tools

## Port Publishing Strategies

Control how services expose ports:

```yaml
version: '3.8'

services:
  # Short syntax - host:container
  web:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    networks:
      - public

  # Long syntax with protocol specification
  api:
    image: node:18-alpine
    ports:
      - target: 3000
        published: 3000
        protocol: tcp
        mode: host
    networks:
      - app-network

  # Random host port
  app:
    image: myapp:latest
    ports:
      - "3000"  # Docker assigns random host port
    networks:
      - app-network

  # Bind to specific host interface
  admin:
    image: admin-panel:latest
    ports:
      - "127.0.0.1:8080:80"  # Only accessible from localhost
    networks:
      - admin-network

  # UDP protocol
  dns:
    image: bind9:latest
    ports:
      - "53:53/udp"
      - "53:53/tcp"
    networks:
      - dns-network

  # Range of ports
  streaming:
    image: rtmp-server:latest
    ports:
      - "1935:1935"
      - "8080-8089:8080-8089"
    networks:
      - streaming-network

networks:
  public:
  app-network:
  admin-network:
    internal: true
  dns-network:
  streaming-network:
```

## Container Communication Patterns

### Request-Response Pattern

```yaml
version: '3.8'

services:
  gateway:
    image: nginx:alpine
    networks:
      - frontend
    ports:
      - "80:80"
    volumes:
      - ./nginx-gateway.conf:/etc/nginx/nginx.conf:ro

  service-a:
    image: service-a:latest
    networks:
      - frontend
      - backend
    environment:
      SERVICE_B_URL: http://service-b:8080
      DATABASE_URL: postgresql://db:5432/service_a

  service-b:
    image: service-b:latest
    networks:
      - frontend
      - backend
    environment:
      DATABASE_URL: postgresql://db:5432/service_b

  database:
    image: postgres:15-alpine
    networks:
      - backend
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true

volumes:
  pgdata:
```

### Pub-Sub Pattern

```yaml
version: '3.8'

services:
  publisher:
    image: publisher:latest
    networks:
      - messaging
    environment:
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis

  subscriber-1:
    image: subscriber:latest
    networks:
      - messaging
    environment:
      REDIS_URL: redis://redis:6379
      SUBSCRIBER_ID: "1"
    depends_on:
      - redis

  subscriber-2:
    image: subscriber:latest
    networks:
      - messaging
    environment:
      REDIS_URL: redis://redis:6379
      SUBSCRIBER_ID: "2"
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    networks:
      - messaging
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

networks:
  messaging:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_icc: "true"

volumes:
  redis-data:
```

## Network Troubleshooting Configuration

Enable debugging and monitoring:

```yaml
version: '3.8'

services:
  app:
    image: myapp:latest
    networks:
      app-network:
        aliases:
          - primary-app
    cap_add:
      - NET_ADMIN
      - NET_RAW

  debug:
    image: nicolaka/netshoot:latest
    networks:
      - app-network
    command: sleep infinity
    cap_add:
      - NET_ADMIN
      - NET_RAW
    stdin_open: true
    tty: true

  database:
    image: postgres:15-alpine
    networks:
      app-network:
        aliases:
          - db
    environment:
      POSTGRES_PASSWORD: secret

networks:
  app-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_ip_masquerade: "true"
      com.docker.network.driver.mtu: "1500"
    ipam:
      driver: default
      config:
        - subnet: 172.28.0.0/16
```

Debug commands:

```bash
# Enter debug container
docker compose exec debug bash

# Test connectivity
ping app
curl http://app:8080/health

# Check DNS resolution
nslookup app
dig app

# Network scanning
nmap -p- app

# Trace route
traceroute app

# Monitor traffic
tcpdump -i eth0 -n
```

## IPv6 Networking

Enable IPv6 support:

```yaml
version: '3.8'

services:
  web:
    image: nginx:alpine
    networks:
      - ipv6-network
    ports:
      - "80:80"

  api:
    image: node:18-alpine
    networks:
      ipv6-network:
        ipv6_address: 2001:db8:1::10

  database:
    image: postgres:15-alpine
    networks:
      ipv6-network:
        ipv6_address: 2001:db8:1::20
    environment:
      POSTGRES_PASSWORD: secret

networks:
  ipv6-network:
    driver: bridge
    enable_ipv6: true
    ipam:
      driver: default
      config:
        - subnet: 172.28.0.0/16
        - subnet: 2001:db8:1::/64
```

## When to Use This Skill

Use docker-compose-networking when you need to:

- Configure custom network topologies for multi-container applications
- Implement network segmentation and service isolation
- Set up service discovery and inter-service communication
- Design secure network architectures with frontend/backend separation
- Configure static IP addresses for services
- Connect to external Docker networks
- Implement complex microservices communication patterns
- Troubleshoot network connectivity issues
- Configure DNS resolution and hostname aliases
- Set up pub-sub or message queue architectures
- Enable IPv6 networking
- Optimize network performance with host networking
- Configure port publishing and exposure strategies

## Best Practices

1. **Use Custom Networks for Isolation**: Always create custom networks instead of relying solely on the default network for better security and organization.

2. **Implement Network Segmentation**: Separate frontend, backend, and data tiers into different networks to limit attack surface.

3. **Use Internal Networks**: Mark backend networks as `internal: true` to prevent external access to sensitive services like databases.

4. **Prefer Service Names Over IPs**: Use Docker's built-in DNS and service names instead of hardcoding IP addresses for maintainability.

5. **Configure Health Checks**: Implement health checks to ensure services are ready before routing traffic to them.

6. **Use Network Aliases**: Define meaningful aliases for services to support multiple naming conventions and easier migration.

7. **Avoid Host Networking Unless Necessary**: Use bridge networks by default; host networking should only be used for specific performance requirements.

8. **Document Network Architecture**: Clearly comment your network design and document which services can communicate with each other.

9. **Use Depends_on Wisely**: Combine `depends_on` with health checks to ensure services start in the correct order.

10. **Implement Least Privilege**: Only expose ports that absolutely need to be accessible from outside the Docker network.

11. **Use Environment Variables for URLs**: Configure service endpoints through environment variables for flexibility across environments.

12. **Test Network Isolation**: Regularly verify that services can only communicate through intended network paths.

13. **Configure Appropriate MTU**: Set MTU values based on your network infrastructure to avoid fragmentation issues.

14. **Use External Networks for Shared Resources**: When multiple Compose projects need to communicate, use external networks rather than duplicating services.

15. **Monitor Network Performance**: Use tools like `docker stats` and dedicated monitoring containers to track network usage and identify bottlenecks.

## Common Pitfalls

1. **Exposing All Services Publicly**: Don't publish ports for services that should only be accessed internally; use networks instead of port publishing.

2. **Hardcoding IP Addresses**: Avoid static IP addresses unless absolutely necessary; rely on service discovery instead.

3. **Using Default Network Only**: Not creating custom networks misses opportunities for proper segmentation and isolation.

4. **Ignoring Network Modes**: Using the wrong network mode (bridge vs host vs overlay) for your use case can cause connectivity or performance issues.

5. **Missing Network Dependencies**: Not properly configuring `depends_on` can cause services to fail when trying to connect to unavailable services.

6. **Overusing Host Networking**: Using `network_mode: host` unnecessarily breaks container isolation and portability.

7. **Not Using Internal Networks**: Failing to mark backend networks as internal leaves databases and sensitive services exposed.

8. **Mixing Network Modes**: Trying to publish ports or connect to networks when using `network_mode: host` causes configuration errors.

9. **Circular Network Dependencies**: Creating network dependencies that form a circle prevents containers from starting properly.

10. **Ignoring DNS Configuration**: Not configuring DNS properly can cause name resolution failures in containerized applications.

11. **Subnet Conflicts**: Using IP ranges that conflict with host or other Docker networks causes routing issues.

12. **Not Testing Network Policies**: Assuming network isolation works without testing can leave security vulnerabilities.

13. **Exposing Management Interfaces**: Publishing management ports (like RabbitMQ, Redis, PostgreSQL) without authentication or IP restrictions.

14. **Using Links Instead of Networks**: The deprecated `links` feature should be replaced with modern network configuration.

15. **Ignoring Network Driver Options**: Not configuring driver options like MTU or IP masquerade can cause subtle connectivity problems in production.

## Resources

### Official Documentation

- [Docker Compose Networking](https://docs.docker.com/compose/networking/)
- [Docker Network Drivers](https://docs.docker.com/network/drivers/)
- [Docker DNS](https://docs.docker.com/config/containers/container-networking/#dns-services)

### Network Troubleshooting

- [Nicolaka Netshoot](https://github.com/nicolaka/netshoot) - Network troubleshooting container
- [Docker Network Inspect](https://docs.docker.com/engine/reference/commandline/network_inspect/)

### Architecture Patterns

- [Microservices Network Patterns](https://microservices.io/patterns/communication-style/messaging.html)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)

### Tools

- [Docker Network Commands](https://docs.docker.com/engine/reference/commandline/network/)
- [Compose Network Reference](https://docs.docker.com/compose/compose-file/06-networks/)

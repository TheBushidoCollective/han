---
name: ansible-roles
description: Use when structuring and reusing code with Ansible roles for modular, maintainable automation and configuration management.
allowed-tools: [Bash, Read]
---

# Ansible Roles

Structure and reuse automation code with Ansible roles for modular, maintainable infrastructure.

## Role Directory Structure

A well-organized Ansible role follows a standardized directory structure:

```
roles/
└── webserver/
    ├── README.md
    ├── defaults/
    │   └── main.yml
    ├── files/
    │   ├── nginx.conf
    │   └── ssl/
    │       ├── cert.pem
    │       └── key.pem
    ├── handlers/
    │   └── main.yml
    ├── meta/
    │   └── main.yml
    ├── tasks/
    │   ├── main.yml
    │   ├── install.yml
    │   ├── configure.yml
    │   └── security.yml
    ├── templates/
    │   ├── nginx.conf.j2
    │   └── site.conf.j2
    ├── tests/
    │   ├── inventory
    │   └── test.yml
    └── vars/
        └── main.yml
```

## Basic Role Example

### tasks/main.yml

```yaml
---
# Main task file for webserver role
- name: Include OS-specific variables
  include_vars: "{{ ansible_os_family }}.yml"

- name: Import installation tasks
  import_tasks: install.yml
  tags:
    - install
    - webserver

- name: Import configuration tasks
  import_tasks: configure.yml
  tags:
    - configure
    - webserver

- name: Import security tasks
  import_tasks: security.yml
  tags:
    - security
    - webserver

- name: Ensure nginx is running
  service:
    name: "{{ nginx_service_name }}"
    state: started
    enabled: yes
  tags:
    - service
    - webserver
```

### tasks/install.yml

```yaml
---
# Installation tasks for webserver role
- name: Install nginx and dependencies (Debian/Ubuntu)
  apt:
    name:
      - nginx
      - nginx-extras
      - python3-passlib
    state: present
    update_cache: yes
    cache_valid_time: 3600
  when: ansible_os_family == "Debian"

- name: Install nginx and dependencies (RedHat/CentOS)
  yum:
    name:
      - nginx
      - nginx-mod-stream
      - python3-passlib
    state: present
    update_cache: yes
  when: ansible_os_family == "RedHat"

- name: Create nginx directories
  file:
    path: "{{ item }}"
    state: directory
    owner: "{{ nginx_user }}"
    group: "{{ nginx_group }}"
    mode: '0755'
  loop:
    - "{{ nginx_conf_dir }}/sites-available"
    - "{{ nginx_conf_dir }}/sites-enabled"
    - "{{ nginx_log_dir }}"
    - "{{ nginx_cache_dir }}"
    - /var/www/html

- name: Install certbot for SSL
  apt:
    name: certbot
    state: present
  when:
    - nginx_ssl_enabled
    - ansible_os_family == "Debian"
```

### tasks/configure.yml

```yaml
---
# Configuration tasks for webserver role
- name: Deploy main nginx configuration
  template:
    src: nginx.conf.j2
    dest: "{{ nginx_conf_dir }}/nginx.conf"
    owner: root
    group: root
    mode: '0644'
    validate: 'nginx -t -c %s'
    backup: yes
  notify:
    - Reload nginx
  tags:
    - config

- name: Deploy site configurations
  template:
    src: site.conf.j2
    dest: "{{ nginx_conf_dir }}/sites-available/{{ item.name }}.conf"
    owner: root
    group: root
    mode: '0644'
    validate: 'nginx -t -c {{ nginx_conf_dir }}/nginx.conf'
  loop: "{{ nginx_sites }}"
  when: nginx_sites is defined
  notify:
    - Reload nginx

- name: Enable sites
  file:
    src: "{{ nginx_conf_dir }}/sites-available/{{ item.name }}.conf"
    dest: "{{ nginx_conf_dir }}/sites-enabled/{{ item.name }}.conf"
    state: link
  loop: "{{ nginx_sites }}"
  when:
    - nginx_sites is defined
    - item.enabled | default(true)
  notify:
    - Reload nginx

- name: Disable default site
  file:
    path: "{{ nginx_conf_dir }}/sites-enabled/default"
    state: absent
  when: nginx_disable_default_site
  notify:
    - Reload nginx

- name: Configure log rotation
  template:
    src: logrotate.j2
    dest: /etc/logrotate.d/nginx
    owner: root
    group: root
    mode: '0644'
```

### tasks/security.yml

```yaml
---
# Security tasks for webserver role
- name: Generate dhparam file
  command: openssl dhparam -out {{ nginx_conf_dir }}/dhparam.pem 2048
  args:
    creates: "{{ nginx_conf_dir }}/dhparam.pem"
  when: nginx_ssl_enabled

- name: Set secure permissions on dhparam
  file:
    path: "{{ nginx_conf_dir }}/dhparam.pem"
    owner: root
    group: root
    mode: '0600'
  when: nginx_ssl_enabled

- name: Configure firewall rules (ufw)
  ufw:
    rule: allow
    port: "{{ item }}"
    proto: tcp
  loop:
    - "80"
    - "443"
  when:
    - nginx_configure_firewall
    - ansible_os_family == "Debian"

- name: Configure firewall rules (firewalld)
  firewalld:
    service: "{{ item }}"
    permanent: yes
    state: enabled
    immediate: yes
  loop:
    - http
    - https
  when:
    - nginx_configure_firewall
    - ansible_os_family == "RedHat"

- name: Create basic auth file
  htpasswd:
    path: "{{ nginx_conf_dir }}/.htpasswd"
    name: "{{ item.username }}"
    password: "{{ item.password }}"
    owner: root
    group: "{{ nginx_group }}"
    mode: '0640'
  loop: "{{ nginx_basic_auth_users }}"
  when: nginx_basic_auth_users is defined
  no_log: yes
```

## Role Variables

### defaults/main.yml

```yaml
---
# Default variables for webserver role
# These can be overridden in playbooks or inventory

# Package and service names
nginx_package_name: nginx
nginx_service_name: nginx

# User and group
nginx_user: www-data
nginx_group: www-data

# Directories
nginx_conf_dir: /etc/nginx
nginx_log_dir: /var/log/nginx
nginx_cache_dir: /var/cache/nginx
nginx_pid_file: /var/run/nginx.pid

# Main configuration
nginx_worker_processes: auto
nginx_worker_connections: 1024
nginx_keepalive_timeout: 65
nginx_client_max_body_size: 10m

# Performance tuning
nginx_sendfile: on
nginx_tcp_nopush: on
nginx_tcp_nodelay: on
nginx_gzip: on
nginx_gzip_types:
  - text/plain
  - text/css
  - application/json
  - application/javascript
  - text/xml
  - application/xml

# Security
nginx_ssl_enabled: no
nginx_ssl_protocols: "TLSv1.2 TLSv1.3"
nginx_ssl_ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256"
nginx_ssl_prefer_server_ciphers: on
nginx_disable_default_site: yes
nginx_configure_firewall: yes
nginx_server_tokens: off

# Sites configuration
nginx_sites: []
# Example:
# nginx_sites:
#   - name: example.com
#     server_name: example.com www.example.com
#     root: /var/www/example.com
#     enabled: yes
#     ssl: yes

# Basic authentication
# nginx_basic_auth_users:
#   - username: admin
#     password: secretpassword
```

### vars/main.yml

```yaml
---
# Variables that should not be overridden
nginx_conf_path: "{{ nginx_conf_dir }}/nginx.conf"
nginx_error_log: "{{ nginx_log_dir }}/error.log"
nginx_access_log: "{{ nginx_log_dir }}/access.log"

# OS-specific overrides loaded via include_vars
```

### vars/Debian.yml

```yaml
---
nginx_user: www-data
nginx_group: www-data
nginx_conf_dir: /etc/nginx
nginx_service_name: nginx
```

### vars/RedHat.yml

```yaml
---
nginx_user: nginx
nginx_group: nginx
nginx_conf_dir: /etc/nginx
nginx_service_name: nginx
```

## Role Handlers

### handlers/main.yml

```yaml
---
# Handlers for webserver role
- name: Reload nginx
  service:
    name: "{{ nginx_service_name }}"
    state: reloaded
  listen: "reload nginx"

- name: Restart nginx
  service:
    name: "{{ nginx_service_name }}"
    state: restarted
  listen: "restart nginx"

- name: Validate nginx config
  command: nginx -t
  changed_when: false
  listen: "validate nginx"

- name: Reload firewall
  service:
    name: ufw
    state: reloaded
  when: ansible_os_family == "Debian"
  listen: "reload firewall"
```

## Role Templates

### templates/nginx.conf.j2

```jinja2
# {{ ansible_managed }}
user {{ nginx_user }};
worker_processes {{ nginx_worker_processes }};
pid {{ nginx_pid_file }};

events {
    worker_connections {{ nginx_worker_connections }};
    use epoll;
    multi_accept on;
}

http {
    ##
    # Basic Settings
    ##
    sendfile {{ nginx_sendfile | ternary('on', 'off') }};
    tcp_nopush {{ nginx_tcp_nopush | ternary('on', 'off') }};
    tcp_nodelay {{ nginx_tcp_nodelay | ternary('on', 'off') }};
    keepalive_timeout {{ nginx_keepalive_timeout }};
    types_hash_max_size 2048;
    server_tokens {{ nginx_server_tokens | ternary('on', 'off') }};
    client_max_body_size {{ nginx_client_max_body_size }};

    include {{ nginx_conf_dir }}/mime.types;
    default_type application/octet-stream;

    ##
    # SSL Settings
    ##
{% if nginx_ssl_enabled %}
    ssl_protocols {{ nginx_ssl_protocols }};
    ssl_ciphers {{ nginx_ssl_ciphers }};
    ssl_prefer_server_ciphers {{ nginx_ssl_prefer_server_ciphers | ternary('on', 'off') }};
    ssl_dhparam {{ nginx_conf_dir }}/dhparam.pem;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
{% endif %}

    ##
    # Logging Settings
    ##
    access_log {{ nginx_access_log }};
    error_log {{ nginx_error_log }};

    ##
    # Gzip Settings
    ##
    gzip {{ nginx_gzip | ternary('on', 'off') }};
{% if nginx_gzip %}
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types {{ nginx_gzip_types | join(' ') }};
{% endif %}

    ##
    # Virtual Host Configs
    ##
    include {{ nginx_conf_dir }}/sites-enabled/*;
}
```

### templates/site.conf.j2

```jinja2
# {{ ansible_managed }}
# Site: {{ item.name }}

{% if item.ssl | default(false) %}
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name {{ item.server_name }};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name {{ item.server_name }};

    ssl_certificate {{ item.ssl_cert | default('/etc/letsencrypt/live/' + item.name + '/fullchain.pem') }};
    ssl_certificate_key {{ item.ssl_key | default('/etc/letsencrypt/live/' + item.name + '/privkey.pem') }};
{% else %}
server {
    listen 80;
    listen [::]:80;
    server_name {{ item.server_name }};
{% endif %}

    root {{ item.root | default('/var/www/' + item.name) }};
    index {{ item.index | default('index.html index.htm') }};

{% if item.access_log is defined %}
    access_log {{ item.access_log }};
{% endif %}
{% if item.error_log is defined %}
    error_log {{ item.error_log }};
{% endif %}

{% if item.basic_auth | default(false) %}
    auth_basic "Restricted Access";
    auth_basic_user_file {{ nginx_conf_dir }}/.htpasswd;
{% endif %}

    location / {
{% if item.proxy_pass is defined %}
        proxy_pass {{ item.proxy_pass }};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
{% else %}
        try_files $uri $uri/ =404;
{% endif %}
    }

{% if item.locations is defined %}
{% for location in item.locations %}
    location {{ location.path }} {
{% if location.proxy_pass is defined %}
        proxy_pass {{ location.proxy_pass }};
{% endif %}
{% if location.alias is defined %}
        alias {{ location.alias }};
{% endif %}
{% if location.return is defined %}
        return {{ location.return }};
{% endif %}
    }
{% endfor %}
{% endif %}

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

## Role Dependencies

### meta/main.yml

```yaml
---
galaxy_info:
  role_name: webserver
  author: Your Organization
  description: Install and configure nginx web server
  company: Your Company
  license: MIT
  min_ansible_version: 2.9

  platforms:
    - name: Ubuntu
      versions:
        - focal
        - jammy
    - name: Debian
      versions:
        - buster
        - bullseye
    - name: EL
      versions:
        - 7
        - 8
        - 9

  galaxy_tags:
    - web
    - nginx
    - webserver
    - http

dependencies:
  - role: common
    vars:
      common_packages:
        - curl
        - wget

  - role: firewall
    when: nginx_configure_firewall

allow_duplicates: no
```

## Using Roles in Playbooks

### Simple Role Usage

```yaml
---
- name: Configure web servers
  hosts: webservers
  become: yes

  roles:
    - webserver
```

### Role with Variables

```yaml
---
- name: Configure web servers with custom settings
  hosts: webservers
  become: yes

  roles:
    - role: webserver
      vars:
        nginx_worker_processes: 4
        nginx_ssl_enabled: yes
        nginx_sites:
          - name: example.com
            server_name: example.com www.example.com
            root: /var/www/example.com
            ssl: yes
            ssl_cert: /etc/ssl/certs/example.com.crt
            ssl_key: /etc/ssl/private/example.com.key
```

### Role with Tags

```yaml
---
- name: Configure infrastructure
  hosts: all
  become: yes

  roles:
    - role: webserver
      tags:
        - web
        - nginx

    - role: database
      tags:
        - db
        - postgres
```

### Pre and Post Tasks

```yaml
---
- name: Deploy web application
  hosts: webservers
  become: yes

  pre_tasks:
    - name: Announce deployment
      debug:
        msg: "Starting deployment to {{ inventory_hostname }}"

    - name: Check disk space
      command: df -h /
      register: disk_space
      changed_when: false

  roles:
    - webserver
    - monitoring

  post_tasks:
    - name: Verify nginx is responding
      uri:
        url: http://localhost
        status_code: 200
      retries: 3
      delay: 5

    - name: Notify completion
      debug:
        msg: "Deployment completed successfully"
```

## Role Inclusion Methods

### Static Import

```yaml
---
- name: Configure servers
  hosts: all

  tasks:
    - name: Import webserver role
      import_role:
        name: webserver
      vars:
        nginx_worker_processes: 2
      tags:
        - webserver
```

### Dynamic Include

```yaml
---
- name: Configure servers based on conditions
  hosts: all

  tasks:
    - name: Include webserver role for web servers
      include_role:
        name: webserver
      when: "'webservers' in group_names"

    - name: Include database role for db servers
      include_role:
        name: database
      when: "'databases' in group_names"
```

### Import with Task Files

```yaml
---
- name: Custom installation workflow
  hosts: webservers

  tasks:
    - name: Run pre-installation checks
      import_role:
        name: webserver
        tasks_from: preflight

    - name: Install nginx
      import_role:
        name: webserver
        tasks_from: install

    - name: Configure nginx
      import_role:
        name: webserver
        tasks_from: configure
```

## Creating Roles with Ansible Galaxy

### Initialize a New Role

```bash
# Create role structure
ansible-galaxy init roles/myapp

# Create role with custom template
ansible-galaxy init --init-path roles/ myapp

# List role files
tree roles/myapp
```

### Install Roles from Galaxy

```bash
# Install a role
ansible-galaxy install geerlingguy.nginx

# Install specific version
ansible-galaxy install geerlingguy.nginx,2.8.0

# Install from requirements file
ansible-galaxy install -r requirements.yml
```

### requirements.yml

```yaml
---
# Install from Ansible Galaxy
- name: geerlingguy.nginx
  version: 2.8.0

- name: geerlingguy.postgresql
  version: 3.4.0

# Install from Git repository
- name: custom-app
  src: https://github.com/yourorg/ansible-role-custom-app.git
  scm: git
  version: main

# Install from local path
- name: internal-role
  src: /path/to/roles/internal-role
```

## Advanced Role Patterns

### Role with Multiple Entry Points

```yaml
# roles/webserver/tasks/main.yml
---
- name: Default task flow
  import_tasks: "{{ webserver_task_flow | default('standard') }}.yml"
```

```yaml
# roles/webserver/tasks/standard.yml
---
- import_tasks: install.yml
- import_tasks: configure.yml
- import_tasks: security.yml
```

```yaml
# roles/webserver/tasks/minimal.yml
---
- import_tasks: install.yml
- import_tasks: configure.yml
```

### Conditional Role Execution

```yaml
---
- name: Configure servers with conditional roles
  hosts: all
  become: yes

  roles:
    - role: webserver
      when:
        - ansible_os_family == "Debian"
        - inventory_hostname in groups['webservers']

    - role: webserver-nginx
      when: webserver_type == "nginx"

    - role: webserver-apache
      when: webserver_type == "apache"
```

### Nested Role Dependencies

```yaml
# roles/application/meta/main.yml
---
dependencies:
  - role: webserver
    vars:
      nginx_sites:
        - name: "{{ app_name }}"
          server_name: "{{ app_domain }}"
          proxy_pass: "http://localhost:{{ app_port }}"

  - role: database
    vars:
      db_name: "{{ app_db_name }}"
      db_user: "{{ app_db_user }}"

  - role: monitoring
    vars:
      monitor_services:
        - nginx
        - "{{ app_name }}"
```

## When to Use This Skill

Use the ansible-roles skill when you need to:

- Structure reusable automation code across multiple playbooks and projects
- Implement modular infrastructure as code with clear separation of concerns
- Share automation logic between teams or projects
- Create distributable automation packages for common infrastructure patterns
- Organize complex playbooks into manageable, testable components
- Implement role-based configuration management with variable precedence
- Build layered infrastructure with role dependencies
- Version control automation logic independently from playbooks
- Create standardized infrastructure components for consistency
- Implement security and compliance requirements through reusable roles
- Build internal automation libraries for your organization
- Contribute to or consume community automation from Ansible Galaxy
- Test infrastructure components in isolation before integration
- Implement different configurations for development, staging, and production
- Create self-documenting infrastructure through role metadata

## Best Practices

1. **Follow standard directory structure** - Use ansible-galaxy init to create roles with proper organization
2. **Use defaults wisely** - Place overridable variables in defaults/main.yml, non-overridable in vars/main.yml
3. **Document thoroughly** - Include comprehensive README.md with usage examples and variable documentation
4. **Keep roles focused** - Each role should have a single, well-defined purpose
5. **Use role dependencies** - Declare dependencies in meta/main.yml rather than in playbooks
6. **Tag appropriately** - Apply meaningful tags to tasks for selective execution
7. **Implement idempotency** - Ensure roles can be run multiple times safely
8. **Version your roles** - Use semantic versioning for role releases
9. **Test roles independently** - Include test playbooks in tests/ directory
10. **Use templates for configuration** - Prefer Jinja2 templates over static files for flexibility
11. **Implement OS detection** - Use ansible_os_family for cross-platform compatibility
12. **Secure sensitive data** - Use ansible-vault for passwords and secrets in role variables
13. **Use handlers correctly** - Only notify handlers when configuration changes
14. **Validate configurations** - Use validate parameter in template/copy modules
15. **Name tasks clearly** - Use descriptive names that explain what each task does

## Common Pitfalls

1. **Overly complex roles** - Trying to make one role do too many things
2. **Poor variable naming** - Using generic names that conflict with other roles
3. **Missing role prefix** - Not prefixing role variables with role name
4. **Ignoring variable precedence** - Not understanding how Ansible resolves variable conflicts
5. **Hard-coded values** - Embedding environment-specific values instead of using variables
6. **Missing dependencies** - Not declaring role dependencies in meta/main.yml
7. **No validation** - Deploying configurations without validation checks
8. **Skipping tests** - Not including test playbooks or scenarios
9. **Poor handler design** - Restarting services unnecessarily or not at all
10. **Missing OS support** - Assuming all target systems are the same
11. **No backup strategy** - Not backing up configurations before changes
12. **Ignoring idempotency** - Using command/shell modules without proper guards
13. **Missing tags** - Not tagging tasks for selective execution
14. **Poor template practices** - Complex logic in templates instead of variables
15. **No version control** - Not versioning roles or tracking changes

## Resources

- [Ansible Roles Documentation](https://docs.ansible.com/ansible/latest/user_guide/playbooks_reuse_roles.html)
- [Ansible Galaxy](https://galaxy.ansible.com/)
- [Role Directory Structure](https://docs.ansible.com/ansible/latest/user_guide/playbooks_reuse_roles.html#role-directory-structure)
- [Variable Precedence](https://docs.ansible.com/ansible/latest/user_guide/playbooks_variables.html#variable-precedence-where-should-i-put-a-variable)
- [ansible-galaxy CLI](https://docs.ansible.com/ansible/latest/cli/ansible-galaxy.html)
- [Best Practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)
- [Role Dependencies](https://docs.ansible.com/ansible/latest/user_guide/playbooks_reuse_roles.html#role-dependencies)
- [Testing Strategies](https://docs.ansible.com/ansible/latest/dev_guide/testing.html)

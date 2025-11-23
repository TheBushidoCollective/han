---
name: ansible-inventory
description: Use when managing hosts and groups in Ansible inventory for organizing infrastructure and applying configurations across environments.
allowed-tools: [Bash, Read]
---

# Ansible Inventory

Manage hosts and groups in Ansible inventory for organized infrastructure management.

## INI Format Inventory

### Basic Host Definitions

```ini
# Simple host list
mail.example.com
web1.example.com
web2.example.com
db1.example.com

# Hosts with aliases
web1 ansible_host=192.168.1.10
web2 ansible_host=192.168.1.11
db1 ansible_host=192.168.1.20

# Hosts with connection parameters
app1 ansible_host=10.0.1.50 ansible_user=deploy ansible_port=2222
app2 ansible_host=10.0.1.51 ansible_user=deploy ansible_port=2222
```

### Group Definitions

```ini
[webservers]
web1.example.com
web2.example.com
web3.example.com

[databases]
db1.example.com
db2.example.com

[monitoring]
monitor1.example.com

[production:children]
webservers
databases

[staging:children]
staging-web
staging-db

[staging-web]
staging-web1.example.com
staging-web2.example.com

[staging-db]
staging-db1.example.com
```

### Host Variables

```ini
[webservers]
web1.example.com http_port=80 max_connections=1000
web2.example.com http_port=8080 max_connections=2000
web3.example.com http_port=80 max_connections=1500

[databases]
db1.example.com db_role=primary
db2.example.com db_role=replica
```

### Group Variables

```ini
[webservers:vars]
nginx_version=1.21.0
app_environment=production
backup_enabled=true

[databases:vars]
postgresql_version=14
max_connections=200
shared_buffers=256MB

[production:vars]
monitoring_enabled=true
log_level=info
```

## YAML Format Inventory

### Basic YAML Inventory

```yaml
---
all:
  hosts:
    mail.example.com:

  children:
    webservers:
      hosts:
        web1.example.com:
          ansible_host: 192.168.1.10
          http_port: 80
        web2.example.com:
          ansible_host: 192.168.1.11
          http_port: 8080
      vars:
        nginx_version: "1.21.0"
        app_environment: production

    databases:
      hosts:
        db1.example.com:
          ansible_host: 192.168.1.20
          db_role: primary
        db2.example.com:
          ansible_host: 192.168.1.21
          db_role: replica
      vars:
        postgresql_version: "14"
        max_connections: 200

    production:
      children:
        webservers:
        databases:
      vars:
        monitoring_enabled: true
        backup_enabled: true
        log_level: info
```

### Complex YAML Inventory

```yaml
---
all:
  vars:
    ansible_user: ansible
    ansible_become: yes
    ansible_become_method: sudo

  children:
    datacenters:
      children:
        us_east:
          children:
            us_east_web:
              hosts:
                web-us-east-1:
                  ansible_host: 10.10.1.10
                  datacenter: us-east-1
                  rack: A1
                web-us-east-2:
                  ansible_host: 10.10.1.11
                  datacenter: us-east-1
                  rack: A2
              vars:
                region: us-east
                availability_zone: us-east-1a

            us_east_db:
              hosts:
                db-us-east-1:
                  ansible_host: 10.10.1.20
                  db_role: primary
                  datacenter: us-east-1
                db-us-east-2:
                  ansible_host: 10.10.1.21
                  db_role: replica
                  datacenter: us-east-1
              vars:
                region: us-east

        us_west:
          children:
            us_west_web:
              hosts:
                web-us-west-1:
                  ansible_host: 10.20.1.10
                  datacenter: us-west-1
                  rack: B1
                web-us-west-2:
                  ansible_host: 10.20.1.11
                  datacenter: us-west-1
                  rack: B2
              vars:
                region: us-west
                availability_zone: us-west-1a

            us_west_db:
              hosts:
                db-us-west-1:
                  ansible_host: 10.20.1.20
                  db_role: primary
                  datacenter: us-west-1
              vars:
                region: us-west
```

## Host Patterns and Ranges

### Numeric Ranges

```ini
[webservers]
web[1:10].example.com

[databases]
db[01:05].example.com

[application]
app-[a:f].example.com
```

```yaml
---
all:
  children:
    webservers:
      hosts:
        web[1:10].example.com:
    databases:
      hosts:
        db[01:05].example.com:
    application:
      hosts:
        app-[a:f].example.com:
```

### Multiple Groups

```ini
[webservers]
web[1:5].example.com

[loadbalancers]
lb[1:2].example.com

[frontend:children]
webservers
loadbalancers

[frontend:vars]
http_port=80
https_port=443
```

## Dynamic Inventory

### Basic Dynamic Inventory Script

```python
#!/usr/bin/env python3
"""
Dynamic inventory script for Ansible
"""
import json
import sys
import argparse

def get_inventory():
    """Return inventory data structure"""
    inventory = {
        'webservers': {
            'hosts': ['web1.example.com', 'web2.example.com'],
            'vars': {
                'nginx_version': '1.21.0',
                'http_port': 80
            }
        },
        'databases': {
            'hosts': ['db1.example.com', 'db2.example.com'],
            'vars': {
                'postgresql_version': '14',
                'db_port': 5432
            }
        },
        'production': {
            'children': ['webservers', 'databases'],
            'vars': {
                'environment': 'production',
                'monitoring_enabled': True
            }
        },
        '_meta': {
            'hostvars': {
                'web1.example.com': {
                    'ansible_host': '192.168.1.10',
                    'http_port': 80
                },
                'web2.example.com': {
                    'ansible_host': '192.168.1.11',
                    'http_port': 8080
                },
                'db1.example.com': {
                    'ansible_host': '192.168.1.20',
                    'db_role': 'primary'
                },
                'db2.example.com': {
                    'ansible_host': '192.168.1.21',
                    'db_role': 'replica'
                }
            }
        }
    }
    return inventory

def get_host_vars(host):
    """Return variables for a specific host"""
    inventory = get_inventory()
    return inventory['_meta']['hostvars'].get(host, {})

def main():
    """Main execution"""
    parser = argparse.ArgumentParser(description='Dynamic Ansible Inventory')
    parser.add_argument('--list', action='store_true', help='List all groups')
    parser.add_argument('--host', help='Get variables for a specific host')
    args = parser.parse_args()

    if args.list:
        print(json.dumps(get_inventory(), indent=2))
    elif args.host:
        print(json.dumps(get_host_vars(args.host), indent=2))
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == '__main__':
    main()
```

### AWS EC2 Dynamic Inventory

```python
#!/usr/bin/env python3
"""
AWS EC2 dynamic inventory for Ansible
"""
import json
import boto3
from collections import defaultdict

def get_ec2_inventory():
    """Fetch EC2 instances and build inventory"""
    ec2 = boto3.client('ec2')

    inventory = defaultdict(lambda: {'hosts': [], 'vars': {}})
    hostvars = {}

    # Fetch all running instances
    response = ec2.describe_instances(
        Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
    )

    for reservation in response['Reservations']:
        for instance in reservation['Instances']:
            instance_id = instance['InstanceId']
            private_ip = instance.get('PrivateIpAddress', '')
            public_ip = instance.get('PublicIpAddress', '')

            # Get instance name from tags
            name = instance_id
            for tag in instance.get('Tags', []):
                if tag['Key'] == 'Name':
                    name = tag['Value']
                    break

            # Build host variables
            hostvars[name] = {
                'ansible_host': public_ip or private_ip,
                'private_ip': private_ip,
                'public_ip': public_ip,
                'instance_id': instance_id,
                'instance_type': instance['InstanceType'],
                'availability_zone': instance['Placement']['AvailabilityZone']
            }

            # Group by tags
            for tag in instance.get('Tags', []):
                key = tag['Key']
                value = tag['Value']

                if key == 'Environment':
                    group = f"env_{value}"
                    inventory[group]['hosts'].append(name)

                if key == 'Role':
                    group = f"role_{value}"
                    inventory[group]['hosts'].append(name)

                if key == 'Application':
                    group = f"app_{value}"
                    inventory[group]['hosts'].append(name)

            # Group by instance type
            type_group = f"type_{instance['InstanceType']}"
            inventory[type_group]['hosts'].append(name)

            # Group by availability zone
            az_group = f"az_{instance['Placement']['AvailabilityZone']}"
            inventory[az_group]['hosts'].append(name)

    # Add meta hostvars
    inventory['_meta'] = {'hostvars': hostvars}

    return dict(inventory)

if __name__ == '__main__':
    import sys
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--list', action='store_true')
    parser.add_argument('--host')
    args = parser.parse_args()

    if args.list:
        print(json.dumps(get_ec2_inventory(), indent=2))
    elif args.host:
        inventory = get_ec2_inventory()
        print(json.dumps(inventory['_meta']['hostvars'].get(args.host, {}), indent=2))
```

### Inventory Plugin Configuration

```yaml
# inventory.aws_ec2.yml
---
plugin: amazon.aws.aws_ec2

regions:
  - us-east-1
  - us-west-2

filters:
  instance-state-name: running
  tag:Environment: production

keyed_groups:
  # Group by instance type
  - key: instance_type
    prefix: type
    separator: "_"

  # Group by availability zone
  - key: placement.availability_zone
    prefix: az

  # Group by tags
  - key: tags.Role
    prefix: role

  - key: tags.Environment
    prefix: env

compose:
  ansible_host: public_ip_address | default(private_ip_address)
  datacenter: placement.availability_zone

hostnames:
  - tag:Name
  - instance-id
```

## Inventory Directory Structure

### Organized Inventory Layout

```
inventory/
├── production/
│   ├── hosts.yml
│   ├── group_vars/
│   │   ├── all.yml
│   │   ├── webservers.yml
│   │   ├── databases.yml
│   │   └── loadbalancers.yml
│   └── host_vars/
│       ├── web1.example.com.yml
│       ├── web2.example.com.yml
│       └── db1.example.com.yml
├── staging/
│   ├── hosts.yml
│   ├── group_vars/
│   │   ├── all.yml
│   │   ├── webservers.yml
│   │   └── databases.yml
│   └── host_vars/
│       └── staging-web1.example.com.yml
└── development/
    ├── hosts.yml
    └── group_vars/
        └── all.yml
```

### group_vars/all.yml

```yaml
---
# Variables for all hosts
ansible_user: ansible
ansible_become: yes
ansible_become_method: sudo
ansible_python_interpreter: /usr/bin/python3

# Common packages
common_packages:
  - vim
  - htop
  - curl
  - wget
  - git

# NTP configuration
ntp_servers:
  - 0.pool.ntp.org
  - 1.pool.ntp.org
  - 2.pool.ntp.org

# Monitoring
monitoring_enabled: yes
monitoring_endpoint: https://monitoring.example.com

# Logging
syslog_server: syslog.example.com
log_retention_days: 30

# Security
security_ssh_port: 22
security_enable_firewall: yes
security_allowed_ssh_networks:
  - 10.0.0.0/8
  - 172.16.0.0/12
```

### group_vars/webservers.yml

```yaml
---
# Web server specific variables
nginx_version: "1.21.0"
nginx_worker_processes: auto
nginx_worker_connections: 1024

# SSL configuration
ssl_enabled: yes
ssl_certificate_path: /etc/ssl/certs
ssl_key_path: /etc/ssl/private

# Application settings
app_name: myapp
app_port: 3000
app_user: www-data
app_log_dir: /var/log/{{ app_name }}

# Performance tuning
keepalive_timeout: 65
client_max_body_size: 10m
gzip_enabled: yes

# Load balancer configuration
load_balancer_backend_timeout: 60
load_balancer_health_check: /health

# Backup settings
backup_enabled: yes
backup_schedule: "0 2 * * *"
backup_retention: 7
```

### group_vars/databases.yml

```yaml
---
# Database specific variables
postgresql_version: "14"
postgresql_port: 5432
postgresql_max_connections: 200
postgresql_shared_buffers: 256MB

# Data directory
postgresql_data_dir: /var/lib/postgresql/{{ postgresql_version }}/main

# Backup configuration
db_backup_enabled: yes
db_backup_schedule: "0 3 * * *"
db_backup_retention: 14
db_backup_dir: /backup/postgresql

# Replication
replication_enabled: yes
replication_user: replicator

# Performance tuning
postgresql_effective_cache_size: 1GB
postgresql_work_mem: 4MB
postgresql_maintenance_work_mem: 64MB

# Monitoring
db_monitoring_enabled: yes
slow_query_log_enabled: yes
slow_query_threshold: 1000
```

### host_vars/web1.example.com.yml

```yaml
---
# Host-specific variables for web1
ansible_host: 192.168.1.10

# Hardware specifications
cpu_cores: 4
memory_gb: 8
disk_size_gb: 100

# Network configuration
primary_ip: 192.168.1.10
secondary_ip: 192.168.1.110
network_interface: eth0

# Role-specific overrides
nginx_worker_processes: 4
app_instances: 2

# Monitoring
monitoring_tags:
  - production
  - web
  - critical

# Maintenance window
maintenance_window: "Sunday 02:00-04:00"
```

## Inventory Variables

### Variable Precedence

```yaml
# Lowest to highest precedence:
# 1. role defaults (defaults/main.yml)
# 2. inventory file or script group vars
# 3. inventory group_vars/all
# 4. playbook group_vars/all
# 5. inventory group_vars/*
# 6. playbook group_vars/*
# 7. inventory file or script host vars
# 8. inventory host_vars/*
# 9. playbook host_vars/*
# 10. host facts / cached set_facts
# 11. play vars
# 12. play vars_prompt
# 13. play vars_files
# 14. role vars (vars/main.yml)
# 15. block vars (only for tasks in block)
# 16. task vars (only for the task)
# 17. include_vars
# 18. set_facts / registered vars
# 19. role (and include_role) params
# 20. include params
# 21. extra vars (-e on command line)
```

### Using Inventory Variables

```yaml
---
- name: Deploy application
  hosts: webservers

  tasks:
    - name: Display inventory variables
      debug:
        msg: |
          Host: {{ inventory_hostname }}
          IP: {{ ansible_host }}
          Environment: {{ app_environment }}
          Port: {{ http_port }}
          Groups: {{ group_names }}

    - name: Deploy to correct environment
      template:
        src: app.conf.j2
        dest: /etc/app/config.yml
      vars:
        config_environment: "{{ app_environment }}"
        config_port: "{{ app_port }}"
```

## Connection Variables

### SSH Connection Settings

```ini
[webservers]
web1 ansible_host=192.168.1.10 ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/web_key
web2 ansible_host=192.168.1.11 ansible_user=centos ansible_port=2222

[webservers:vars]
ansible_connection=ssh
ansible_become=yes
ansible_become_method=sudo
ansible_become_user=root
```

```yaml
---
all:
  vars:
    ansible_connection: ssh
    ansible_user: ansible
    ansible_ssh_private_key_file: ~/.ssh/ansible_key
    ansible_become: yes
    ansible_become_method: sudo

  children:
    webservers:
      hosts:
        web1:
          ansible_host: 192.168.1.10
          ansible_port: 22
        web2:
          ansible_host: 192.168.1.11
          ansible_port: 2222
```

### Alternative Connection Methods

```yaml
---
all:
  children:
    windows_hosts:
      hosts:
        win1:
          ansible_host: 192.168.1.50
      vars:
        ansible_connection: winrm
        ansible_user: Administrator
        ansible_password: "{{ windows_password }}"
        ansible_winrm_transport: ntlm
        ansible_winrm_server_cert_validation: ignore

    containers:
      hosts:
        container1:
          ansible_connection: docker
          ansible_host: container_name

    local_tasks:
      hosts:
        localhost:
          ansible_connection: local
          ansible_python_interpreter: /usr/bin/python3
```

## Inventory Testing and Validation

### List Inventory

```bash
# List all hosts
ansible-inventory -i inventory/production/hosts.yml --list

# List in YAML format
ansible-inventory -i inventory/production/hosts.yml --list -y

# Show inventory graph
ansible-inventory -i inventory/production/hosts.yml --graph

# Show specific host
ansible-inventory -i inventory/production/hosts.yml --host web1.example.com
```

### Verify Host Groups

```bash
# List hosts in a group
ansible webservers -i inventory/production/hosts.yml --list-hosts

# List all groups
ansible all -i inventory/production/hosts.yml --list-hosts

# Test connectivity
ansible all -i inventory/production/hosts.yml -m ping

# Gather facts
ansible webservers -i inventory/production/hosts.yml -m setup
```

### Inventory Patterns in Commands

```bash
# Single host
ansible web1.example.com -i inventory/production -m ping

# Multiple hosts
ansible web1.example.com,web2.example.com -i inventory/production -m ping

# All hosts in group
ansible webservers -i inventory/production -m ping

# All hosts in multiple groups
ansible webservers:databases -i inventory/production -m ping

# Hosts in group A but not in group B
ansible webservers:!staging -i inventory/production -m ping

# Hosts in both groups
ansible webservers:&production -i inventory/production -m ping

# Wildcard patterns
ansible web*.example.com -i inventory/production -m ping

# Regex patterns
ansible ~web[0-9]+\.example\.com -i inventory/production -m ping
```

## When to Use This Skill

Use the ansible-inventory skill when you need to:

- Organize infrastructure hosts into logical groups for automation
- Define connection parameters and credentials for remote systems
- Structure multi-environment deployments (dev, staging, production)
- Implement infrastructure as code with version-controlled inventory
- Create dynamic inventory from cloud providers or external systems
- Apply role-based configurations across server groups
- Manage variables at different scope levels (global, group, host)
- Implement hierarchical host grouping with parent-child relationships
- Support multiple data center or region deployments
- Create reusable inventory patterns for consistent deployments
- Integrate with external CMDBs or asset management systems
- Test and validate infrastructure organization before applying changes
- Document infrastructure topology and relationships
- Implement targeted deployments to specific host subsets
- Support complex targeting with inventory patterns and filters

## Best Practices

1. **Use version control** - Keep inventory files in Git for tracking and collaboration
2. **Organize by environment** - Separate production, staging, and development inventories
3. **Use YAML format** - Prefer YAML over INI for better structure and readability
4. **Group variables appropriately** - Use group_vars for shared settings, host_vars for specific overrides
5. **Implement clear naming** - Use consistent, descriptive names for hosts and groups
6. **Use inventory plugins** - Leverage dynamic inventory for cloud environments
7. **Secure sensitive data** - Use ansible-vault for passwords and credentials
8. **Document inventory structure** - Include README files explaining organization
9. **Test inventory changes** - Use --list and --check before applying changes
10. **Keep it DRY** - Use variable inheritance to avoid duplication
11. **Use meaningful groups** - Create functional groups (webservers) and environmental groups (production)
12. **Implement host patterns** - Use ranges for consistent naming schemes
13. **Separate connection from configuration** - Keep ansible_* connection vars separate from application config
14. **Use inventory directories** - Structure complex inventories as directories, not single files
15. **Cache dynamic inventory** - Implement caching for faster execution with cloud inventories

## Common Pitfalls

1. **Mixing environments** - Putting production and development hosts in same inventory
2. **Hard-coded credentials** - Storing passwords in plain text instead of using vault
3. **Inconsistent naming** - Using different naming schemes across environments
4. **Over-complex structure** - Creating too many nested groups
5. **Missing connection vars** - Not defining ansible_host or ansible_user when needed
6. **Duplicate host definitions** - Same host appearing in multiple inventory files
7. **No variable documentation** - Not explaining what variables mean or their expected values
8. **Ignoring variable precedence** - Not understanding how Ansible resolves conflicts
9. **Static inventory for cloud** - Not using dynamic inventory with AWS, Azure, etc.
10. **No inventory validation** - Not testing inventory before use
11. **Poor group organization** - Creating groups without clear purpose
12. **Missing backup inventory** - Not maintaining previous working inventory versions
13. **Assuming group membership** - Not verifying which groups hosts belong to
14. **Overly broad patterns** - Using wildcards that match unintended hosts
15. **No inventory testing workflow** - Applying inventory changes directly to production

## Resources

- [Ansible Inventory Documentation](https://docs.ansible.com/ansible/latest/user_guide/intro_inventory.html)
- [Working with Dynamic Inventory](https://docs.ansible.com/ansible/latest/user_guide/intro_dynamic_inventory.html)
- [Inventory Plugins](https://docs.ansible.com/ansible/latest/plugins/inventory.html)
- [Patterns and Ad-Hoc Commands](https://docs.ansible.com/ansible/latest/user_guide/intro_patterns.html)
- [Using Variables](https://docs.ansible.com/ansible/latest/user_guide/playbooks_variables.html)
- [Ansible Vault](https://docs.ansible.com/ansible/latest/user_guide/vault.html)
- [AWS EC2 Inventory Plugin](https://docs.ansible.com/ansible/latest/collections/amazon/aws/aws_ec2_inventory.html)
- [Best Practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)

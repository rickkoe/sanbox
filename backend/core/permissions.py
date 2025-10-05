"""
Permission helper functions for role-based access control.

This module provides utilities for checking user permissions based on
CustomerMembership roles (admin/member/viewer).
"""
from typing import Optional
from django.contrib.auth.models import User
from customers.models import Customer
from core.models import Project, CustomerMembership


def get_user_role(user: User, customer: Customer) -> Optional[str]:
    """
    Get the user's role for a specific customer.

    Args:
        user: The User object
        customer: The Customer object

    Returns:
        str: The role ('admin', 'member', 'viewer') or None if no membership exists
    """
    try:
        membership = CustomerMembership.objects.get(customer=customer, user=user)
        return membership.role
    except CustomerMembership.DoesNotExist:
        return None


def has_customer_access(user: User, customer: Customer, min_role: str = 'viewer') -> bool:
    """
    Check if user has at least the specified role for a customer.

    Role hierarchy: admin > member > viewer

    Args:
        user: The User object
        customer: The Customer object
        min_role: Minimum required role ('admin', 'member', or 'viewer')

    Returns:
        bool: True if user has sufficient permissions
    """
    if not user or not user.is_authenticated:
        return False

    # Superusers have access to everything
    if user.is_superuser:
        return True

    role = get_user_role(user, customer)
    if not role:
        return False

    # Role hierarchy
    role_hierarchy = {'viewer': 0, 'member': 1, 'admin': 2}

    user_level = role_hierarchy.get(role, -1)
    required_level = role_hierarchy.get(min_role, 0)

    return user_level >= required_level


def can_view_customer(user: User, customer: Customer) -> bool:
    """
    Check if user can view a customer's data.

    Args:
        user: The User object
        customer: The Customer object

    Returns:
        bool: True if user has at least viewer access
    """
    return has_customer_access(user, customer, min_role='viewer')


def can_edit_customer_infrastructure(user: User, customer: Customer) -> bool:
    """
    Check if user can edit customer-level infrastructure (Fabrics, Storage).
    Only admins can modify customer-level resources.

    Args:
        user: The User object
        customer: The Customer object

    Returns:
        bool: True if user is an admin for this customer
    """
    return has_customer_access(user, customer, min_role='admin')


def can_modify_project(user: User, project: Project) -> bool:
    """
    Check if user can modify a project.
    Users can modify their own projects, or any project if they're a customer admin.

    Args:
        user: The User object
        project: The Project object

    Returns:
        bool: True if user can modify the project
    """
    if not user or not user.is_authenticated:
        return False

    # Superusers can modify anything
    if user.is_superuser:
        return True

    # Project owner can modify their project
    if project.owner == user:
        return True

    # Customer admins can modify any project
    # Get the customer for this project (through the many-to-many relationship)
    customers = project.customers.all()
    for customer in customers:
        if has_customer_access(user, customer, min_role='admin'):
            return True

    return False


def can_create_project(user: User, customer: Customer) -> bool:
    """
    Check if user can create projects for a customer.
    Members and admins can create projects.

    Args:
        user: The User object
        customer: The Customer object

    Returns:
        bool: True if user can create projects
    """
    return has_customer_access(user, customer, min_role='member')


def get_user_customers(user: User):
    """
    Get all customers the user has access to.

    Args:
        user: The User object

    Returns:
        QuerySet: Customer objects the user is a member of
    """
    if not user or not user.is_authenticated:
        return Customer.objects.none()

    # Superusers see all customers
    if user.is_superuser:
        return Customer.objects.all()

    # Get customers through memberships
    customer_ids = CustomerMembership.objects.filter(
        user=user
    ).values_list('customer_id', flat=True)

    return Customer.objects.filter(id__in=customer_ids)


def get_user_projects(user: User, customer: Optional[Customer] = None):
    """
    Get all projects the user has access to.
    If customer is specified, filter to that customer.

    Args:
        user: The User object
        customer: Optional Customer object to filter by

    Returns:
        QuerySet: Project objects the user can access
    """
    if not user or not user.is_authenticated:
        return Project.objects.none()

    # Superusers see all projects
    if user.is_superuser:
        if customer:
            return Project.objects.filter(customers=customer)
        return Project.objects.all()

    # Get projects owned by user
    owned_projects = Project.objects.filter(owner=user)

    # Get projects from customers where user is admin
    admin_customer_ids = CustomerMembership.objects.filter(
        user=user,
        role='admin'
    ).values_list('customer_id', flat=True)

    admin_projects = Project.objects.filter(customers__id__in=admin_customer_ids)

    # Combine owned and admin projects
    projects = (owned_projects | admin_projects).distinct()

    # Filter by customer if specified
    if customer:
        projects = projects.filter(customers=customer)

    return projects


def is_customer_admin(user: User, customer: Customer) -> bool:
    """
    Check if user is an admin for a customer.

    Args:
        user: The User object
        customer: The Customer object

    Returns:
        bool: True if user is an admin
    """
    return has_customer_access(user, customer, min_role='admin')


def is_customer_member(user: User, customer: Customer) -> bool:
    """
    Check if user is at least a member (member or admin) for a customer.

    Args:
        user: The User object
        customer: The Customer object

    Returns:
        bool: True if user is a member or admin
    """
    return has_customer_access(user, customer, min_role='member')


def get_user_customer_ids(user: User):
    """
    Get list of customer IDs that the user has access to.

    Args:
        user: Django User object

    Returns:
        list: List of customer IDs, or None if superuser (indicating access to all)
    """
    if not user or not user.is_authenticated:
        return []

    if user.is_superuser:
        return None  # None = all customers

    return list(CustomerMembership.objects.filter(
        user=user
    ).values_list('customer_id', flat=True))


def filter_by_customer_access(queryset, user: User, customer_field: str = 'customer'):
    """
    Filter a queryset to only include items from customers the user has access to.

    Args:
        queryset: Django QuerySet to filter
        user: Django User object
        customer_field: Name of the field that references Customer (default: 'customer')

    Returns:
        Filtered QuerySet
    """
    customer_ids = get_user_customer_ids(user)

    if customer_ids is None:
        # Superuser - return all
        return queryset

    if not customer_ids:
        # No access - return empty queryset
        return queryset.none()

    # Filter by accessible customers
    filter_kwargs = {f'{customer_field}_id__in': customer_ids}
    return queryset.filter(**filter_kwargs)


def filter_by_fabric_customer_access(queryset, user: User):
    """
    Filter a queryset to only include items from fabrics belonging to accessible customers.
    Used for Alias and Zone models which reference Fabric.

    Args:
        queryset: Django QuerySet to filter (Alias or Zone)
        user: Django User object

    Returns:
        Filtered QuerySet
    """
    customer_ids = get_user_customer_ids(user)

    if customer_ids is None:
        # Superuser - return all
        return queryset

    if not customer_ids:
        # No access - return empty queryset
        return queryset.none()

    # Filter by fabrics belonging to accessible customers
    return queryset.filter(fabric__customer_id__in=customer_ids)

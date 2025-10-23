#!/usr/bin/env python3
"""
Script to remove permission-related functions from core/views.py
"""

# Functions to completely remove (with their decorators)
FUNCTIONS_TO_REMOVE = [
    'user_customer_memberships',
    'customer_memberships_list',
    'customer_invite_user',
    'customer_membership_detail',
    'project_groups_list',
    'project_group_detail',
    'project_group_members',
    'project_group_member_remove',
]

def find_function_bounds(lines, func_name):
    """Find the start and end line numbers for a function"""
    start_line = None
    decorator_start = None
    end_line = None
    indent_level = None

    for i, line in enumerate(lines):
        # Look for the function definition
        if f'def {func_name}(' in line:
            start_line = i
            # Find decorator start (look backwards for @csrf_exempt or @require_http_methods)
            for j in range(i-1, max(0, i-10), -1):
                if lines[j].strip().startswith('@'):
                    decorator_start = j
                elif lines[j].strip() and not lines[j].strip().startswith('#'):
                    break

            # Get indentation level
            indent_level = len(line) - len(line.lstrip())

            # Find end of function (next function at same level or end of file)
            for j in range(i+1, len(lines)):
                curr_line = lines[j]
                if curr_line.strip():
                    curr_indent = len(curr_line) - len(curr_line.lstrip())
                    # Found next function or class at same or lower indent level
                    if (curr_line.strip().startswith('def ') or curr_line.strip().startswith('class ')) and curr_indent <= indent_level:
                        end_line = j
                        break

            if end_line is None:
                end_line = len(lines)

            break

    return decorator_start or start_line, end_line

def main():
    views_file = '/Users/rickk/sanbox/backend/core/views.py'

    with open(views_file, 'r') as f:
        lines = f.readlines()

    # Collect all ranges to remove
    ranges_to_remove = []
    for func_name in FUNCTIONS_TO_REMOVE:
        start, end = find_function_bounds(lines, func_name)
        if start is not None:
            ranges_to_remove.append((start, end, func_name))
            print(f"Found {func_name}: lines {start+1}-{end}")

    # Sort ranges in reverse order to remove from bottom to top
    ranges_to_remove.sort(reverse=True)

    # Remove the functions
    for start, end, func_name in ranges_to_remove:
        # Replace with a comment
        comment = f"\n# {func_name} removed - CustomerMembership/ProjectGroup no longer exist\n\n"
        lines[start:end] = [comment]

    # Write back
    with open(views_file, 'w') as f:
        f.writelines(lines)

    print(f"\nRemoved {len(ranges_to_remove)} functions")
    print("Updated core/views.py")

if __name__ == '__main__':
    main()

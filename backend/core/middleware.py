"""
Middleware for audit logging
"""

from threading import local

_thread_locals = local()


def get_current_user():
    """Get the current user from thread-local storage"""
    return getattr(_thread_locals, 'user', None)


class AuditLogMiddleware:
    """
    Middleware to store the current user in thread-local storage
    for use by Django signals
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Store the user in thread-local storage
        _thread_locals.user = getattr(request, 'user', None)

        response = self.get_response(request)

        # Clean up
        if hasattr(_thread_locals, 'user'):
            del _thread_locals.user

        return response

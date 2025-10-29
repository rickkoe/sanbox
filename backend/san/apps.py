from django.apps import AppConfig


class SanConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'san'

    def ready(self):
        """Import signals when the app is ready"""
        import san.signals  # noqa

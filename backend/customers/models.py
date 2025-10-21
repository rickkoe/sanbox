from django.db import models

class Customer(models.Model):
    name = models.CharField(max_length=200, unique=True)
    projects = models.ManyToManyField("core.Project", related_name="customers", blank=True)
    notes = models.TextField(null=True, blank=True)
    insights_api_key = models.CharField(max_length=600, null=True, blank=True)
    insights_tenant = models.CharField(max_length=200, null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ContactInfo(models.Model):
    """
    Contact information model for storing contacts universally across the app.
    Can be used in worksheets, reports, and other customer communications.
    """
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='contact_info',
        help_text="Customer this contact belongs to"
    )
    name = models.CharField(
        max_length=200,
        help_text="Contact person's full name"
    )
    email = models.EmailField(
        help_text="Contact email address"
    )
    phone_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Contact phone number"
    )
    title = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Contact's job title or role"
    )
    is_default = models.BooleanField(
        default=False,
        help_text="Use this contact as default for worksheets and reports"
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Additional notes about this contact"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', 'name']
        verbose_name = "Contact Information"
        verbose_name_plural = "Contact Information"
        indexes = [
            models.Index(fields=['customer', 'is_default']),
        ]

    def __str__(self):
        return f"{self.name} ({self.customer.name})"

    def save(self, *args, **kwargs):
        """Ensure only one default contact per customer"""
        if self.is_default:
            ContactInfo.objects.filter(
                customer=self.customer,
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
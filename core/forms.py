from django import forms
from .models import Config

class ConfigForm(forms.ModelForm):
    class Meta:
        model = Config
        fields = ['project', 'zoning_job_name', 'san_vendor', 'cisco_alias', 'cisco_zoning_mode', 'zone_ratio', 'smartzone_prefix', 'alias_max_zones']

from django.shortcuts import render
from django.urls import reverse

def get_san_toolbar():
    """Return a consistent toolbar configuration for SAN-related views with dynamic URLs."""
    return [
        {"label": "Aliases", "url": reverse("san:aliases")},
        {"label": "Zones", "url": reverse("san:zones")},
    ]

def index(request):
    return render(request, 'san/index.html')

def aliases(request):
    return render(request, 'san/aliases.html', {"toolbar_options": get_san_toolbar()})

def zones(request):
    return render(request, 'san/zones.html', {"toolbar_options": get_san_toolbar()})

def create_aliases(request):
    return render(request, 'san/create_aliases.html', {"toolbar_options": get_san_toolbar()})


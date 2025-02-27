from django.shortcuts import render
from django.urls import reverse
from core.models import Config
from .models import Fabric, Alias

def get_san_toolbar():
    """Return a consistent toolbar configuration for SAN-related views with dynamic URLs."""
    return [
        {"label": "Aliases", "url": reverse("san:aliases")},
        {"label": "Zones", "url": reverse("san:zones")},
    ]

def fabrics_data(request):
    config = Config.objects.first()
    fabrics = Fabric.objects.filter(project=config.project)
    data = [{'id': fabric.id, 'name': fabric.name, 'vsan': fabric.vsan, 'exists': fabric.exists} for fabric in fabrics]
    return JsonResponse(data, safe=False)

def alias_data(request):
    config = Config.objects.first()
    aliases = Alias.objects.filter(fabric__project=config.project)
    data = [{'id': alias.id, 'name': alias.name, 'fabric': alias.fabric.name, 'use': alias.use, 'create': alias.create, 'include_in_zoning': alias.include_in_zoning} for alias in aliases]
    return JsonResponse(data, safe=False)  

def index(request):
    return render(request, 'san/index.html')

def zones(request):
    return render(request, 'san/zones.html', {"toolbar_options": get_san_toolbar()})

def create_aliases(request):
    return render(request, 'san/create_aliases.html', {"toolbar_options": get_san_toolbar()})

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

# Sample data for the table (pretend this is from a database)
DATA = alias_data

def aliases(request):
    config = Config.objects.first()
    # For GET requests, we just send all the records to the template

    aliases = Alias.objects.values('id','name','wwpn','use','fabric__name','storage__name','host__name','create','include_in_zoning').filter(fabric__project=config.project)

        # Convert QuerySet to a list before modifying data
    aliases_list = list(aliases)
            # Convert boolean fields to lowercase in each fabric dictionary
    for alias in aliases:
        for field_name, field_value in alias.items():
            if isinstance(field_value, bool):
                alias[field_name] = str(field_value).lower()
                # Convert Python None to JSON null
            if field_value is None:
                    alias[field_name] = 'null'
    
    context = {'aliases': list(aliases),
                'heading': 'Aliases',
                'pageview': 'Zoning',
                'toolbar_options': get_san_toolbar(),
                'data': json.dumps(aliases_list)}  
    return render(request, 'san/aliases.html', context)

@csrf_exempt
def save_aliases(request):
    """Save data from Handsontable."""
    if request.method == "POST":
        try:
            new_data = json.loads(request.body)
            print("Received Data:", new_data)  # Debugging (view in terminal)
            return JsonResponse({'status': 'success', 'message': 'Data saved!'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    return JsonResponse({'status': 'invalid request'}, status=400)




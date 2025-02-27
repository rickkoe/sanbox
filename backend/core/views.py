from django.shortcuts import render, redirect
from django.http import HttpResponse
from .models import Config
from .forms import ConfigForm

def home(request):
    return HttpResponse("Hello from Core App!")

def index(request):
    return render(request, 'core/index.html')

def config(request):
    config_instance, created = Config.objects.get_or_create(pk=1)  # Get or create a single instance
    
    if request.method == 'POST':
        form = ConfigForm(request.POST, instance=config_instance)
        if form.is_valid():
            form.save()
            return redirect('config')  # Redirect back to the config page
    else:
        form = ConfigForm(instance=config_instance)
    config = Config.objects.first()
    context = {
        'form': form,
        'active_customer': config.project.customer,
        'heading': 'Config',
        'pageview': 'Settings'
        }
    return render(request, 'core/config.html', context)
    
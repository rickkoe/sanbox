from django.shortcuts import render

def index(request):
    return render(request, "index.html")  # Serve React's index.html
    
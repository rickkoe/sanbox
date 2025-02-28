from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Alias, Zone, Fabric
from .serializers import AliasSerializer, ZoneSerializer, FabricSerializer

@api_view(["GET", "POST"])
def alias_list(request):
    if request.method == "GET":
        aliases = Alias.objects.all()
        serializer = AliasSerializer(aliases, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = AliasSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT"])
def alias_update(request, pk):
    try:
        alias = Alias.objects.get(pk=pk)
    except Alias.DoesNotExist:
        return Response({"error": "Alias not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = AliasSerializer(alias, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET", "POST"])
def zone_list(request):
    if request.method == "GET":
        zones = Zone.objects.all()
        serializer = ZoneSerializer(zones, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = ZoneSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT"])
def zone_update(request, pk):
    try:
        zone = Zone.objects.get(pk=pk)
    except Zone.DoesNotExist:
        return Response({"error": "Zone not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = ZoneSerializer(zone, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET", "POST"])
def fabric_list(request):
    if request.method == "GET":
        fabrics = Fabric.objects.all()
        serializer = FabricSerializer(fabrics, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = FabricSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT"])
def fabric_update(request, pk):
    try:
        fabric = Fabric.objects.get(pk=pk)
    except Fabric.DoesNotExist:
        return Response({"error": "Fabric not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = FabricSerializer(fabric, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
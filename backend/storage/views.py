from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Storage
from .serializers import StorageSerializer

@api_view(["GET", "POST"])
def storage_list(request):
    if request.method == "GET":
        storages = Storage.objects.all()
        serializer = StorageSerializer(storages, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = StorageSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT"])
def storage_update(request, pk):
    try:
        storage = Storage.objects.get(pk=pk)
    except Storage.DoesNotExist:
        return Response({"error": "Storage not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = StorageSerializer(storage, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
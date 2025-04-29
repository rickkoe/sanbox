from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Storage
from .serializers import StorageSerializer

@api_view(["GET", "POST"])
def storage_list(request):
    if request.method == "GET":
        # Get all storage items
        storages = Storage.objects.all()
        
        # Filter by customer if provided in query params
        customer_id = request.query_params.get('customer')
        if customer_id:
            storages = storages.filter(customer_id=customer_id)
            
        serializer = StorageSerializer(storages, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = StorageSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT", "DELETE", "GET"])
def storage_detail(request, pk):
    try:
        storage = Storage.objects.get(pk=pk)
    except Storage.DoesNotExist:
        return Response({"error": "Storage not found"}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == "GET":
        serializer = StorageSerializer(storage)
        return Response(serializer.data)
    
    elif request.method == "PUT":
        serializer = StorageSerializer(storage, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == "DELETE":
        storage.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
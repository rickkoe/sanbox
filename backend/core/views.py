from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Config
from .serializers import ConfigSerializer

@api_view(["GET", "PUT"])
def config_detail(request):
    try:
        config = Config.objects.first()  # ✅ Only fetch the first config object
    except Config.DoesNotExist:
        return Response({"error": "No Config found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        serializer = ConfigSerializer(config)
        return Response(serializer.data)

    elif request.method == "PUT":
        serializer = ConfigSerializer(config, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
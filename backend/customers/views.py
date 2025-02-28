from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Customer
from .serializer import CustomerSerializer  # Ensure this is correctly named

@api_view(['GET'])
def customer_list(request):
    customers = Customer.objects.all()
    serializer = CustomerSerializer(customers, many=True)
    return Response(serializer.data)
"""
Views for Worksheet Generator functionality.
Handles equipment types, worksheet templates, and worksheet generation.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.db.models import Q
from django.conf import settings
import io
import os
from datetime import datetime

# Import XLSX library for Excel generation
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image as XLImage

from .models import EquipmentType, WorksheetTemplate, CustomerMembership
from .serializers import EquipmentTypeSerializer, WorksheetTemplateSerializer


class EquipmentTypeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing equipment types.
    Provides CRUD operations for equipment types.
    """
    serializer_class = EquipmentTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get all active equipment types, optionally filtered by category"""
        queryset = EquipmentType.objects.filter(is_active=True)

        # Optional filtering by category
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category=category)

        return queryset.order_by('category', 'display_order', 'name')

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get list of all equipment categories"""
        categories = EquipmentType.CATEGORY_CHOICES
        return Response([
            {'value': cat[0], 'label': cat[1]}
            for cat in categories
        ])

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Get equipment types grouped by category"""
        categories = {}
        equipment_types = self.get_queryset()

        for eq_type in equipment_types:
            category = eq_type.category
            if category not in categories:
                categories[category] = []

            serializer = self.get_serializer(eq_type)
            categories[category].append(serializer.data)

        return Response(categories)


class WorksheetTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing worksheet templates.
    Provides CRUD operations for worksheet templates.
    """
    serializer_class = WorksheetTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get templates accessible to the user"""
        user = self.request.user

        # Get customer IDs the user has access to
        customer_ids = CustomerMembership.objects.filter(
            user=user
        ).values_list('customer_id', flat=True)

        # Get templates: global templates + user's templates + customer templates
        queryset = WorksheetTemplate.objects.filter(
            Q(is_global=True) |
            Q(user=user) |
            Q(customer_id__in=customer_ids)
        )

        # Optional filtering
        customer_id = self.request.query_params.get('customer', None)
        if customer_id:
            queryset = queryset.filter(
                Q(is_global=True) | Q(customer_id=customer_id)
            )

        return queryset.select_related('customer', 'user').prefetch_related('equipment_types')

    def perform_create(self, serializer):
        """Create template with current user"""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'])
    def generate_worksheet(self, request):
        """
        Generate an Excel worksheet based on the provided configuration.

        Expected payload:
        {
            "customer_name": "Customer Name",
            "project_name": "Project Name",
            "contact": {
                "name": "Contact Name",
                "email": "contact@email.com",
                "phone": "123-456-7890",
                "title": "Position"
            },
            "equipment": [
                {
                    "type_id": 1,
                    "type_name": "SAN Switch",
                    "quantity": 2,
                    "items": [
                        {
                            "switch_name": "SW01",
                            "management_ip": "10.0.0.1",
                            ...
                        }
                    ]
                }
            ]
        }
        """
        try:
            data = request.data

            # Create Excel workbook
            wb = Workbook()
            ws = wb.active
            ws.title = "Implementation Worksheet"

            # Define styles - Company Branding Colors
            # Color Palette:
            # #505050 - Dark Gray (headers, text)
            # #b3b3b3 - Light Gray (subheaders, borders)
            # #a2ca62 - Green (primary accent)
            # #64cae6 - Blue (secondary accent)
            # #ffffff - White (backgrounds, text on dark)

            header_font = Font(name='Calibri', size=14, bold=True, color='FFFFFF')
            header_fill = PatternFill(start_color='505050', end_color='505050', fill_type='solid')  # Dark Gray
            subheader_font = Font(name='Calibri', size=12, bold=True, color='505050')  # Dark Gray text
            subheader_fill = PatternFill(start_color='B3B3B3', end_color='B3B3B3', fill_type='solid')  # Light Gray
            accent_green_fill = PatternFill(start_color='A2CA62', end_color='A2CA62', fill_type='solid')  # Green
            accent_blue_fill = PatternFill(start_color='64CAE6', end_color='64CAE6', fill_type='solid')  # Blue
            normal_font = Font(name='Calibri', size=11, color='505050')  # Dark Gray
            bold_font = Font(name='Calibri', size=11, bold=True, color='505050')  # Dark Gray
            center_alignment = Alignment(horizontal='center', vertical='center')
            left_alignment = Alignment(horizontal='left', vertical='center')
            thin_border = Border(
                left=Side(style='thin', color='B3B3B3'),
                right=Side(style='thin', color='B3B3B3'),
                top=Side(style='thin', color='B3B3B3'),
                bottom=Side(style='thin', color='B3B3B3')
            )

            current_row = 1

            # Add company logo
            logo_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'company-logo.png')
            if os.path.exists(logo_path):
                try:
                    # Insert logo image
                    img = XLImage(logo_path)
                    # Get original dimensions
                    original_width = img.width
                    original_height = img.height
                    # Scale logo to fit nicely (adjust height to ~60 pixels)
                    target_height = 60
                    if original_height > 0:
                        aspect_ratio = original_width / original_height
                        img.height = target_height
                        img.width = int(target_height * aspect_ratio)
                    # Position logo at A1
                    ws.add_image(img, 'A1')
                    # Set row height to accommodate logo
                    ws.row_dimensions[1].height = 45
                    ws.row_dimensions[2].height = 15
                    ws.row_dimensions[3].height = 15
                    current_row = 4  # Skip rows used by logo
                except Exception as e:
                    # Fallback to placeholder if image loading fails
                    print(f"Error loading logo: {e}")
                    ws.merge_cells(f'A{current_row}:D{current_row}')
                    cell = ws[f'A{current_row}']
                    cell.value = "[COMPANY LOGO]"
                    cell.font = Font(name='Calibri', size=12, italic=True, color='505050')
                    cell.alignment = center_alignment
                    current_row += 2
            else:
                # Fallback to placeholder if logo doesn't exist
                ws.merge_cells(f'A{current_row}:D{current_row}')
                cell = ws[f'A{current_row}']
                cell.value = "[COMPANY LOGO]"
                cell.font = Font(name='Calibri', size=12, italic=True, color='505050')
                cell.alignment = center_alignment
                current_row += 2

            # Add title with green accent
            ws.merge_cells(f'A{current_row}:D{current_row}')
            cell = ws[f'A{current_row}']
            cell.value = "Equipment Implementation Worksheet"
            cell.font = Font(name='Calibri', size=16, bold=True, color='FFFFFF')
            cell.fill = accent_green_fill  # Green accent for title
            cell.alignment = center_alignment
            current_row += 2

            # Add project information section
            ws[f'A{current_row}'] = "Project Information"
            ws[f'A{current_row}'].font = subheader_font
            ws[f'A{current_row}'].fill = subheader_fill
            ws.merge_cells(f'A{current_row}:D{current_row}')
            current_row += 1

            # Customer name
            ws[f'A{current_row}'] = "Customer:"
            ws[f'A{current_row}'].font = bold_font
            ws[f'B{current_row}'] = data.get('customer_name', '')
            ws.merge_cells(f'B{current_row}:D{current_row}')
            current_row += 1

            # Project name
            ws[f'A{current_row}'] = "Project:"
            ws[f'A{current_row}'].font = bold_font
            ws[f'B{current_row}'] = data.get('project_name', '')
            ws.merge_cells(f'B{current_row}:D{current_row}')
            current_row += 1

            # Date
            ws[f'A{current_row}'] = "Date:"
            ws[f'A{current_row}'].font = bold_font
            ws[f'B{current_row}'] = datetime.now().strftime('%Y-%m-%d')
            ws.merge_cells(f'B{current_row}:D{current_row}')
            current_row += 2

            # Add contact information section
            contact = data.get('contact', {})
            if contact:
                ws[f'A{current_row}'] = "Contact Information"
                ws[f'A{current_row}'].font = subheader_font
                ws[f'A{current_row}'].fill = subheader_fill
                ws.merge_cells(f'A{current_row}:D{current_row}')
                current_row += 1

                ws[f'A{current_row}'] = "Name:"
                ws[f'A{current_row}'].font = bold_font
                ws[f'B{current_row}'] = contact.get('name', '')
                current_row += 1

                ws[f'A{current_row}'] = "Email:"
                ws[f'A{current_row}'].font = bold_font
                ws[f'B{current_row}'] = contact.get('email', '')
                current_row += 1

                ws[f'A{current_row}'] = "Phone:"
                ws[f'A{current_row}'].font = bold_font
                ws[f'B{current_row}'] = contact.get('phone', '')
                current_row += 1

                if contact.get('title'):
                    ws[f'A{current_row}'] = "Title:"
                    ws[f'A{current_row}'].font = bold_font
                    ws[f'B{current_row}'] = contact.get('title', '')
                    current_row += 1

                current_row += 1

            # Add equipment sections
            equipment_list = data.get('equipment', [])
            for equipment in equipment_list:
                # Equipment type header
                ws[f'A{current_row}'] = f"{equipment.get('type_name', 'Equipment')} Details"
                ws[f'A{current_row}'].font = subheader_font
                ws[f'A{current_row}'].fill = subheader_fill
                ws.merge_cells(f'A{current_row}:D{current_row}')
                current_row += 1

                items = equipment.get('items', [])
                if items and len(items) > 0:
                    # Get field names from first item
                    fields = list(items[0].keys())

                    # Column headers row - Blue accent
                    for col_idx, field in enumerate(fields, start=1):
                        cell = ws.cell(row=current_row, column=col_idx)
                        # Convert field name to readable label (snake_case to Title Case)
                        label = field.replace('_', ' ').title()
                        cell.value = label
                        cell.font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
                        cell.fill = accent_blue_fill  # Blue accent for data headers
                        cell.alignment = center_alignment
                        cell.border = thin_border
                    current_row += 1

                    # Data rows with alternating row colors
                    for row_idx, item in enumerate(items):
                        for col_idx, field in enumerate(fields, start=1):
                            cell = ws.cell(row=current_row, column=col_idx)
                            cell.value = item.get(field, '')
                            cell.font = normal_font
                            cell.alignment = left_alignment
                            cell.border = thin_border
                            # Alternating row colors for better readability
                            if row_idx % 2 == 1:
                                cell.fill = PatternFill(start_color='F5F5F5', end_color='F5F5F5', fill_type='solid')
                        current_row += 1

                    current_row += 1  # Blank row between equipment types

            # Add footer section
            current_row += 2  # Add some space

            # Footer separator
            ws.merge_cells(f'A{current_row}:D{current_row}')
            cell = ws[f'A{current_row}']
            cell.value = ""
            cell.border = Border(top=Side(style='thick', color='505050'))
            current_row += 1

            # Contact info footer (if contact was provided)
            contact = data.get('contact', {})
            if contact and contact.get('name'):
                ws.merge_cells(f'A{current_row}:D{current_row}')
                cell = ws[f'A{current_row}']
                cell.value = "Contact Information"
                cell.font = Font(name='Calibri', size=10, bold=True, color='505050')
                current_row += 1

                ws.merge_cells(f'A{current_row}:D{current_row}')
                cell = ws[f'A{current_row}']
                footer_text = f"{contact.get('name', '')}"
                if contact.get('title'):
                    footer_text += f" - {contact.get('title', '')}"
                if contact.get('email'):
                    footer_text += f" | {contact.get('email', '')}"
                if contact.get('phone'):
                    footer_text += f" | {contact.get('phone', '')}"
                cell.value = footer_text
                cell.font = Font(name='Calibri', size=9, color='505050')
                cell.alignment = center_alignment
                current_row += 1

            # Generated timestamp
            ws.merge_cells(f'A{current_row}:D{current_row}')
            cell = ws[f'A{current_row}']
            cell.value = f"Generated on {datetime.now().strftime('%Y-%m-%d at %H:%M')}"
            cell.font = Font(name='Calibri', size=8, italic=True, color='B3B3B3')
            cell.alignment = center_alignment

            # Auto-adjust column widths
            for column in ws.columns:
                max_length = 0
                column_letter = get_column_letter(column[0].column)
                for cell in column:
                    try:
                        if cell.value:
                            max_length = max(max_length, len(str(cell.value)))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)  # Cap at 50 characters
                ws.column_dimensions[column_letter].width = adjusted_width

            # Save to BytesIO
            output = io.BytesIO()
            wb.save(output)
            output.seek(0)

            # Create response
            filename = f"implementation_worksheet_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            response = HttpResponse(
                output.read(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            return response

        except Exception as e:
            return Response(
                {"error": f"Failed to generate worksheet: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

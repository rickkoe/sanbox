'use strict';
$.ajaxSetup({
    headers: { "X-CSRFToken": getCookie("csrftoken") }
});

let hostTable;
const fabricSelectOptions = [];
const storageSelectOptions = [];
const hostSelectOptions = [];
const fabricData = [];
const storageData = [];
const hostData = [];



$(document).ready(function () {
    let container = document.getElementById('hostTable');
    // Function to calculate viewport height

    // Check if data array is empty and add an empty row if necessary
    if (typeof data === 'undefined' || data.length === 0) {
        data = [[]];
    }

    hostTable = new Handsontable(container, {
        // className: 'table table-dark',
        licenseKey: 'non-commercial-and-evaluation',
        data: data,
        minRows: 1,
        minCols: 4,
        rowHeaders: false,
        width: '100%',
        height: '100%',
        columnSorting: true,


        // when selection reaches the edge of the grid's viewport, scroll the viewport
        dragToScroll: true,
        colHeaders: ["ID", "Host Name", "Storage", "WWPNs"],
        contextMenu: ['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo'],  // Custom context menu options
        minSpareRows: 1,  // Always leave one spare row at the end
        // Enable column resizing
        manualColumnResize: true,
        // Disable ID column
        cells: function (row, col, prop) {
            if (col === 0) {
                return { readOnly: true };
            }
        },
        columns: [
            { data: 'id', readOnly: true },
            { data: 'name' },
            { data: 'storage' },
            { data: 'wwpns', readOnly: true },
        ],
        filters: true,
        dropdownMenu: true,

    });
        }
    );



$('#submit-data').click(function () {
    hostTable.getPlugin('Filters').clearConditions();
    hostTable.getPlugin('Filters').filter();
    hostTable.render();
    let data = hostTable.getData().map(function (row) {
        console.log(row);
        if (row[1] || row[2] || row[3] || row[4]) {  // Only send rows that have at least one of these fields filled
            return {
                id: row[0],
                name: row[1]
            };
        }
    });

    // Filter out any undefined entries (rows that didn't pass the check)

    data = data.filter(function (entry) { return entry !== undefined; });

    $.ajax({
        type: 'POST',
        url: '',
        data: {
            'data': JSON.stringify(data),
            'csrfmiddlewaretoken': $('input[name=csrfmiddlewaretoken]').val(),
        },
        success: function () {
            location.reload();
        },
    });
});

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        let cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            let cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;

    // When the user clicks on the button, scroll to the top of the Handsontable
    function topFunction() {
        hostTable.scrollViewportTo(0, 0);
    }
}

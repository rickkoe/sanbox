'use strict';
$.ajaxSetup({
    headers: { "X-CSRFToken": getCookie("csrftoken") }
});

let volumeRangeTable;
const storageSelectOptions = [];
const storageData = [];

$(document).ready(function () {
    let container = document.getElementById('volumeRangeTable');
    // Function to calculate viewport height
    function calculateViewportHeight() {
        return window.innerHeight;
    }


    // Check if data array is empty and add an empty row if necessary
    if (typeof data === 'undefined' || data.length === 0) {
        data = [[]];
    }

    $.ajax({
        url: '/storage_data/', // Replace with the appropriate URL to fetch fabric data
        type: 'GET',
        dataType: 'json',
        success: function (storageData) {
            // Populate the storageSelectOptions array with fabric names and IDs
            for (let i = 0; i < storageData.length; i++) {
                storageSelectOptions.push({
                    label: storageData[i].name,
                    id: storageData[i].id,
                });
            }
        }
    });

    console.log(data);
    volumeRangeTable = new Handsontable(container, {
        // className: 'table table-dark',
        className: 'customTable', 
        licenseKey: 'non-commercial-and-evaluation',
        data: data,
        minRows: 1,
        minCols: 7,
        rowHeaders: false,
        width: '100%',
        height: '100%',
        columnSorting: true,


        // when selection reaches the edge of the grid's viewport, scroll the viewport
        dragToScroll: true,
        colHeaders: ['ID', 'Target Site', 'LPAR', 'Use', 'Source DS8k', 'Source Pool', 'Source Start', 'Source End', 'Target DS8k', 'Target Start', 'Target End', 'Create'],
        contextMenu: ['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo'],  // Custom context menu options
        minSpareRows: 1,  // Always leave one spare row at the end
        // Enable column resizing
        manualColumnResize: true,
        // Disable ID column
        cells: function(row, col, prop) {
            const cellProperties = {};
            if(row % 2 === 0) {
                cellProperties.className = 'darkRow';
            } else {
                cellProperties.className = 'lightRow'
            }
            if (col === 7 || col === 8) {
                cellProperties.className = (cellProperties.className || '') + ' htCenter'; // Append to existing classes
            }
            return cellProperties;
        },
        columns: [
            { data: 'id', readOnly: true },
            { data: 'site' },
            { data: 'lpar' },
            { data: 'use' },
            {
                data: 'source_ds8k__name',
                type: 'dropdown',
                source: function (query, process) {
                    process(storageSelectOptions.map(function (storage) {
                        return storage.label;
                    }));
                },
                
                renderer: function (instance, td, row, col, prop, value, cellProperties) {
                    Handsontable.renderers.TextRenderer.apply(this, arguments);
                    if (prop === "source_ds8k__name" && value !== null) {
                        let storage = storageSelectOptions.find(function (storage) {
                            return storage.label === value;
                        });
                        if (storage) {
                            td.innerHTML = storage.label;
                        }
                    }
                },
                trimDropdown: false
            },
            { data: 'source_pool' },
            { data: 'source_start' },
            { data: 'source_end' },
            {
                data: 'target_ds8k__name',
                type: 'dropdown',
                source: function (query, process) {
                    process(storageSelectOptions.map(function (storage) {
                        return storage.label;
                    }));
                },
                
                renderer: function (instance, td, row, col, prop, value, cellProperties) {
                    Handsontable.renderers.TextRenderer.apply(this, arguments);
                    if (prop === "target_ds8k__name" && value !== null) {
                        let storage = storageSelectOptions.find(function (storage) {
                            return storage.label === value;
                        });
                        if (storage) {
                            td.innerHTML = storage.label;
                        }
                    }
                },
                trimDropdown: false
            },
            { data: 'target_start' },
            { data: 'target_end' },
            {
                data: 'create',
                type: "checkbox",
                className: "htCenter"
            },
        ],
        filters: true,
        dropdownMenu: true,

    
    });
        }
    );



$('#submit-data').click(function () {
    volumeRangeTable.getPlugin('Filters').clearConditions();
    volumeRangeTable.getPlugin('Filters').filter();
    volumeRangeTable.render();
    let data = volumeRangeTable.getData().map(function (row) {
        if (row[2] || row[3]) {
            let rowData = {
                id: row[0],
                site: row[1],
                lpar: row[2],
                use: row[3],
                source_ds8k: row[4],
                source_pool: row[5],
                source_start: row[6],
                source_end: row[7],
                target_ds8k: row[8],
                target_start: row[9],
                target_end: row[10],
                create: row[11]
            };

            return rowData;
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
        aliasTable.scrollViewportTo(0, 0);
    }
}

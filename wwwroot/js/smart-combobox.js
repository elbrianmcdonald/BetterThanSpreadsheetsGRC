/**
 * Smart Combobox Component using Select2
 * Provides autocomplete functionality with ability to add new entries
 */

// Initialize smart comboboxes when document is ready
$(document).ready(function() {
    console.log('Smart combobox script loaded');
    console.log('jQuery available:', typeof $ !== 'undefined');
    console.log('Select2 available:', typeof $.fn.select2 !== 'undefined');
    
    // Make initializeSmartComboboxes globally available immediately
    window.initializeSmartComboboxes = initializeSmartComboboxes;
    
    // If Select2 is available, we're good to go
    if (typeof $ !== 'undefined' && typeof $.fn.select2 !== 'undefined') {
        console.log('✅ Select2 is available and ready to use');
    }
});

function convertToTextInputs() {
    console.log('Converting smart comboboxes to text inputs...');
    $('select[data-category]').each(function() {
        const $select = $(this);
        const currentValue = $select.val() || '';
        const name = $select.attr('name');
        const category = $select.data('category');
        const placeholder = $select.data('placeholder') || 'Type to search or enter new value...';
        const required = $select.prop('required');
        
        // Create wrapper div for positioning the suggestions
        const $wrapper = $('<div class="position-relative"></div>');
        
        const $input = $('<input type="text" class="form-control" name="' + name + '" value="' + currentValue + '" placeholder="' + placeholder + '"' + (required ? ' required' : '') + '>');
        
        // Create suggestions dropdown
        const $suggestions = $('<div class="smart-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; background: white; border: 1px solid #ddd; border-top: none; max-height: 200px; overflow-y: auto;"></div>');
        
        // Copy data attributes
        $input.attr('data-category', category);
        $input.attr('data-can-add-new', $select.data('can-add-new'));
        $input.attr('data-placeholder', placeholder);
        
        // Add input and suggestions to wrapper
        $wrapper.append($input);
        $wrapper.append($suggestions);
        
        // Replace select with wrapper
        $select.replaceWith($wrapper);
        
        // Add autocomplete functionality
        addAutocomplete($input, $suggestions, category);
        
        console.log('Converted field:', name, 'to text input with autocomplete');
    });
}

function addAutocomplete($input, $suggestions, category) {
    let currentData = [];
    
    // Fetch data when input gets focus
    $input.on('focus input', function() {
        const query = $(this).val().toLowerCase();
        
        // Fetch suggestions from API
        $.ajax({
            url: `/api/referencedata/search/${category}`,
            data: { q: query },
            method: 'GET',
            success: function(response) {
                console.log('Autocomplete data received:', response);
                
                // Handle different response formats
                let results = [];
                if (response && response.results) {
                    results = response.results;
                } else if (Array.isArray(response)) {
                    results = response;
                }
                
                currentData = results;
                showSuggestions($input, $suggestions, results, query);
            },
            error: function(xhr, status, error) {
                console.log('Autocomplete API error:', error);
                $suggestions.hide();
            }
        });
    });
    
    // Hide suggestions when clicking outside
    $(document).on('click', function(e) {
        if (!$input.is(e.target) && !$suggestions.is(e.target) && $suggestions.has(e.target).length === 0) {
            $suggestions.hide();
        }
    });
    
    // Handle keyboard navigation
    $input.on('keydown', function(e) {
        const $items = $suggestions.find('.suggestion-item');
        const $active = $items.filter('.active');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if ($active.length === 0) {
                $items.first().addClass('active');
            } else {
                $active.removeClass('active').next().addClass('active');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if ($active.length === 0) {
                $items.last().addClass('active');
            } else {
                $active.removeClass('active').prev().addClass('active');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if ($active.length > 0) {
                $input.val($active.text());
                $suggestions.hide();
            }
        } else if (e.key === 'Escape') {
            $suggestions.hide();
        }
    });
}

function showSuggestions($input, $suggestions, results, query) {
    $suggestions.empty();
    
    // Filter and display results
    const filteredResults = results.filter(item => {
        const value = item.value || item.text || item;
        return value.toLowerCase().includes(query);
    });
    
    // Add existing results
    filteredResults.forEach(item => {
        const value = item.value || item.text || item;
        const description = item.description || '';
        
        const $item = $('<div class="suggestion-item p-2" style="cursor: pointer; border-bottom: 1px solid #eee;"></div>');
        $item.html(`<strong>${value}</strong>${description ? `<br><small class="text-muted">${description}</small>` : ''}`);
        
        $item.on('click', function() {
            $input.val(value);
            $suggestions.hide();
        });
        
        $item.on('mouseenter', function() {
            $suggestions.find('.suggestion-item').removeClass('active');
            $(this).addClass('active');
        });
        
        $suggestions.append($item);
    });
    
    // Check if user can add new entries and if query doesn't match existing items
    const canAddNew = $input.attr('data-can-add-new') === 'true';
    const category = $input.attr('data-category');
    
    if (canAddNew && query && query.trim().length > 0) {
        // Check if query exactly matches any existing item
        const exactMatch = filteredResults.some(item => {
            const value = item.value || item.text || item;
            return value.toLowerCase() === query.toLowerCase();
        });
        
        if (!exactMatch) {
            // Add "Create new" option
            const $addNewItem = $('<div class="suggestion-item p-2 bg-light" style="cursor: pointer; border-bottom: 1px solid #eee; border-top: 2px solid #007bff;"></div>');
            $addNewItem.html(`<i class="fas fa-plus text-primary me-2"></i><strong>Add "${query}"</strong><br><small class="text-muted">Create new entry</small>`);
            
            $addNewItem.on('click', function() {
                createNewEntry($input, category, query.trim());
            });
            
            $addNewItem.on('mouseenter', function() {
                $suggestions.find('.suggestion-item').removeClass('active');
                $(this).addClass('active');
            });
            
            $suggestions.append($addNewItem);
        }
    }
    
    // Show suggestions if we have any items (existing or "add new")
    if ($suggestions.children().length > 0) {
        $suggestions.show();
    } else {
        $suggestions.hide();
    }
}

async function createNewEntry($input, category, value) {
    try {
        // Show loading state
        $input.prop('disabled', true);
        showMessage('Creating new entry...', 'info');
        
        const response = await fetch('/api/referencedata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': getAntiForgeryToken()
            },
            body: JSON.stringify({
                category: parseInt(category),
                value: value,
                description: ''
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            // Set the new value in the input
            $input.val(result.value);
            $input.closest('.position-relative').find('.smart-suggestions').hide();
            
            // Show success message
            showMessage(`Successfully added "${result.value}"!`, 'success');
            
            console.log('New entry created:', result);
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to create new entry', 'error');
            console.error('Error creating entry:', error);
        }
    } catch (error) {
        console.error('Error creating new entry:', error);
        showMessage('Failed to create new entry. Please try again.', 'error');
    } finally {
        $input.prop('disabled', false);
    }
}

function getAntiForgeryToken() {
    // Try to get the anti-forgery token from the page
    const token = $('input[name="__RequestVerificationToken"]').val();
    if (token) {
        return token;
    }
    
    // Try to get from meta tag (if using @Html.AntiForgeryToken() in head)
    const metaToken = $('meta[name="__RequestVerificationToken"]').attr('content');
    if (metaToken) {
        return metaToken;
    }
    
    console.warn('Anti-forgery token not found');
    return '';
}

function showMessage(message, type) {
    const alertClass = type === 'success' ? 'alert-success' : 
                      type === 'info' ? 'alert-info' : 'alert-danger';
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle';
    
    const alert = $(`
        <div class="alert ${alertClass} alert-dismissible fade show position-fixed" 
             style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;" role="alert">
            <i class="fas ${icon} me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `);
    
    $('body').append(alert);
    
    // Auto-dismiss after 5 seconds (except for info messages which dismiss after 3 seconds)
    const timeout = type === 'info' ? 3000 : 5000;
    setTimeout(() => {
        alert.alert('close');
    }, timeout);
}

function initializeSmartComboboxes() {
    console.log('initializeSmartComboboxes called');
    console.log('jQuery available:', typeof $ !== 'undefined');
    console.log('Select2 available:', typeof $ !== 'undefined' && typeof $.fn.select2 !== 'undefined');
    
    if (typeof $ === 'undefined') {
        console.error('jQuery is not available');
        return;
    }
    
    if (typeof $.fn.select2 === 'undefined') {
        console.error('Select2 is not available - falling back to text inputs with autocomplete');
        convertToTextInputs();
        return;
    }
    
    const $selects = $('select[data-category], select.smart-combobox');
    console.log('Found smart combobox selects:', $selects.length);
    
    $selects.each(function() {
        const $select = $(this);
        
        // Skip if already initialized
        if ($select.hasClass('select2-hidden-accessible')) {
            console.log('Skipping already initialized select:', $select.attr('name'));
            return;
        }
        
        const category = $select.data('category');
        const canAddNew = $select.data('can-add-new') === 'true' || $select.data('can-add-new') === true;
        const placeholder = $select.data('placeholder') || 'Type to search...';
        
        console.log('Initializing smart combobox:', {
            name: $select.attr('name'),
            id: $select.attr('id'),
            category: category,
            canAddNew: canAddNew,
            placeholder: placeholder
        });
        
        try {
            // Initialize Select2 with Bootstrap 5 theme
            $select.select2({
                theme: 'bootstrap-5',
                width: '100%',
                placeholder: placeholder,
                allowClear: true,
                minimumInputLength: 0,
                tags: false, // Don't use Select2's built-in tags feature
                ajax: {
                    url: `/api/referencedata/search/${category}`,
                    dataType: 'json',
                    delay: 250,
                    data: function (params) {
                        return {
                            q: params.term || '',
                            page: params.page || 1
                        };
                    },
                    processResults: function (data, params) {
                        // Capture canAddNew in closure
                        const userCanAddNew = canAddNew;
                        console.log('API Response for category', category, ':', data);
                        
                        // Check if response is valid JSON (detect HTML responses from auth redirects)
                        if (typeof data === 'string' && data.includes('<html>')) {
                            console.error('API returned HTML instead of JSON - likely authentication issue');
                            showMessage('Authentication error - please refresh the page and try again', 'error');
                            return { results: [] };
                        }
                        
                        const results = [];
                        
                        // Handle different response formats
                        let dataResults = [];
                        if (data && data.results) {
                            // Expected format: { results: [...] }
                            dataResults = data.results;
                        } else if (Array.isArray(data)) {
                            // Direct array format: [...]
                            dataResults = data;
                        } else {
                            console.error('API returned unexpected data structure:', data);
                            showMessage('Error loading dropdown data - please try again', 'error');
                            return { results: [] };
                        }
                        
                        // Add existing results
                        dataResults.forEach(function(item) {
                            results.push({
                                id: item.value || item.id || item,
                                text: item.value || item.label || item.text || item
                            });
                        });
                        
                        // Add "Add new" option if user can add new entries and search term doesn't exist
                        console.log('Checking add new option:', {
                            userCanAddNew: userCanAddNew,
                            term: params.term,
                            termLength: params.term ? params.term.length : 0
                        });
                        
                        if (userCanAddNew && params.term && params.term.length >= 1) {
                            const searchTerm = params.term.toLowerCase();
                            const existingMatch = results.find(r => r.text.toLowerCase() === searchTerm);
                            if (!existingMatch) {
                                console.log('Adding "Add new" option for:', params.term);
                                results.unshift({
                                    id: `__new__${params.term}`,
                                    text: `➕ Add "${params.term}"`,
                                    isNew: true,
                                    newValue: params.term
                                });
                            }
                        }
                        
                        return {
                            results: results,
                            pagination: { more: false }
                        };
                    },
                    transport: function(params, success, failure) {
                        var $request = $.ajax(params);
                        
                        $request.then(function(data, textStatus, jqXHR) {
                            // Check if we got redirected to login (authentication issue)
                            if (typeof data === 'string' && data.includes('<html>')) {
                                console.error('Authentication required - got HTML response instead of JSON');
                                showMessage('Please log in to use this feature', 'error');
                                failure();
                                return;
                            }
                            
                            success(data);
                        });
                        
                        $request.fail(function(jqXHR, textStatus, errorThrown) {
                            console.error('API request failed:', textStatus, errorThrown);
                            if (jqXHR.status === 401 || jqXHR.status === 302) {
                                showMessage('Authentication required - please log in', 'error');
                            } else {
                                showMessage('Failed to load dropdown data - please try again', 'error');
                            }
                            failure();
                        });
                        
                        return $request;
                    },
                    cache: true
                }
            });
            
            console.log('Select2 initialized successfully for:', $select.attr('name'));
        } catch (error) {
            console.error('Error initializing Select2 for', $select.attr('name'), ':', error);
        }
        
        // Handle selection of new items
        $select.on('select2:select', function (e) {
            const data = e.params.data;
            if (data.isNew) {
                createNewEntry($select, category, data.newValue);
            } else {
                // Track usage for existing entries
                trackUsage(category, data.text);
            }
        });
    });
}

async function createNewEntry($select, category, value) {
    try {
        console.log('Creating new entry:', { category, value });
        
        const response = await fetch('/api/referencedata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            body: JSON.stringify({
                category: parseInt(category),
                value: value,
                description: ''
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            // Clear the select2 and set the new value
            $select.empty();
            const newOption = new Option(result.value, result.value, true, true);
            $select.append(newOption).trigger('change');
            
            // Show success message
            showMessage('New entry added successfully!', 'success');
            
            // Track usage for the new entry
            trackUsage(category, result.value);
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to add new entry', 'error');
            
            // Reset selection
            $select.val(null).trigger('change');
        }
    } catch (error) {
        console.error('Error creating new entry:', error);
        showMessage('Failed to add new entry', 'error');
        $select.val(null).trigger('change');
    }
}

async function trackUsage(category, value) {
    try {
        // Find the entry ID for the value
        const response = await fetch(`/api/referencedata/${category}`);
        if (response.ok) {
            const entries = await response.json();
            const entry = entries.find(e => e.value === value);
            if (entry) {
                // Track usage asynchronously - don't wait for response
                fetch(`/api/referencedata/usage/${entry.id}`, {
                    method: 'POST'
                }).catch(() => {
                    // Silent fail for usage tracking
                });
            }
        }
    } catch (error) {
        // Silent fail for usage tracking
    }
}

function showMessage(message, type) {
    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    
    const alert = $(`
        <div class="alert ${alertClass} alert-dismissible fade show position-fixed" 
             style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;" role="alert">
            <i class="fas ${icon} me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `);
    
    $('body').append(alert);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alert.alert('close');
    }, 5000);
}



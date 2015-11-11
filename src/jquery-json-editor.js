/*!
 *  jQuery JSON Editor
 *  ==================
 *  A jQuery plugin for editing JSON data.
 *
 *  Developed with JavaScript and <3 by jillix developers.
 *  Licensed under the MIT license.
 * */
(function ($) {

    /*!
     * ORDER_PROPERTY
     * Contains the name of the property in the schemas which contains the
     * order in which the fields from the schemas should be laid down in the
     * user interface.
     *
     * @name ORDER_PROPERTY
     * @constant
     * @type {String}
     * @default
     */
    var ORDER_PROPERTY = "_order";

    /*!
     * findValue
     * Finds a value in parent (object) using the dot notation passed in dotNot.
     *
     * @name findValue
     * @function
     * @param {Object} parent The object containing the searched value.
     * @param {String} dotNot Path to the value. If it is not given or it is an
     * empty string, the entire `parent` object will be returned.
     * @return {Anything} Found value or undefined.
     */
    function findValue(parent, dotNot) {

        if (!dotNot) return parent;

        var splits = dotNot.split(".");
        var value;

        for (var i = 0; i < splits.length; ++i) {
            value = parent[splits[i]];
            if (value === undefined) return undefined;
            if (typeof value === "object") parent = value;
        }

        return value;
    }

    /*!
     * flattenObject
     * Converts an object to a flat one.
     *
     * @name flattenObject
     * @function
     * @param {Object} obj The object that should be converted.
     * @return {Object} Flattened object.
     */
    function flattenObject(obj) {

        var result = {};

        for (var key in obj) {
            if (!obj.hasOwnProperty(key)) continue;

            if (obj[key] && obj[key].constructor === Object) {
                var flat = flattenObject (obj[key]);
                for (var x in flat) {
                    if (!flat.hasOwnProperty(x)) {
                        continue;
                    }

                    result[key + '.' + x] = flat[x];
                }
            } else {
                result[key] = obj[key];
            }
        }
        return result;
    }

    /*!
     * unflattenObject
     * Converts a flat object to an unflatten one.
     *
     * @name unflattenObject
     * @function
     * @param {Object} flat The flat object that should be converted.
     * @return {Object} Unflattened object.
     */
    function unflattenObject(flat) {

        var result = {};
        var parentObj = result;

        var keys = Object.keys(flat);
        for (var i = 0; i < keys.length; ++i) {

            var key = keys[i];
            var subkeys = key.split('.');
            var last = subkeys.pop();

            for (var ii = 0; ii < subkeys.length; ++ii) {
                var subkey = subkeys[ii];
                parentObj[subkey] = typeof parentObj[subkey] === 'undefined' ? {} : parentObj[subkey];
                parentObj = parentObj[subkey];
            }

            parentObj[last] = flat[key];
            parentObj = result;
        }

        return result;
    }

    /*!
     * handleArrays
     * Converts object like `{ 0: ..., 1: ..., 2: ... }` into `[..., ..., ...]`.
     *
     * @name handleArrays
     * @function
     * @param {Object} obj Object with numbers as keys or containing objects
     * with numbers as keys.
     * @return {Object} The object with numbers as keys or containing objects
     * with numbers as keys converted to an array or an object with arrays.
     */
    function handleArrays(obj) {
        // Get the keys of the object, which may be numbers as strings.
        var keys = Object.keys(obj);
        // We expect that the object will be converted to an array only if it is
        // not an empty object. If it is an empty object, it will remain an
        // empty object.
        var convert = keys.length !== 0;
        // We convert the keys array to an array of ints. If we detect a key
        // that cannot be converted to an int, we set the flag variable
        // `convert` to false, so we do not treat the object as one that should
        // be converted to an array (but we still call `handleArrays`
        // recursively on the subobjects.
        keys = keys.map(function (key) {
            var val = parseInt(key, 10);
            if (isNaN(val)) {
                convert = false;
            }
            return val;
        }).sort();

        // If the `convert` flag variable is set to true, we create the `arr`
        // variable as an empty array which we will fill. If it is not set to
        // true, we set `arr` to the original object, and then later we call the
        // `handleArrays` function recursively on subobjects. Finally, we return
        // `arr`.
        var arr = convert ? [] : obj;
        if (!convert) {
            for (var k in obj) {
                if (obj[k] && obj[k].constructor === Object) {
                    arr[k] = handleArrays(obj[k]);
                }
            }
        } else {
            keys.forEach(function (key) {
                if (obj[key] && obj[key].constructor === Object) {
                    return (arr[key] = handleArrays(obj[key]));
                }
                arr.push(obj[key]);
            });
        }
        return arr;
    }

    /*!
     * mergeRecursive
     * Merges the two objects in the first object.
     *
     * @name mergeRecursive
     * @function
     * @param {Object} obj1 The first object.
     * @param {Object} obj2 The second object.
     * @return {Object} The two objects merged in the first one.
     */
    function mergeRecursive (obj1, obj2) {
        for (var p in obj2) {
            try {
                if (obj2[p].constructor == Object) {
                    obj1[p] = mergeRecursive(obj1[p], obj2[p]);
                } else {
                    obj1[p] = obj2[p];
                }
            } catch (e) {
                obj1[p] = obj2[p];
            }
        }

        return obj1;
    }

    /*!
     * sch
     * Creates the schema object providing data.
     *
     * @name sch
     * @function
     * @param {Object} obj The current field object.
     * @param {Object} out The field that should be edited (default: `{}`).
     * @param {String} path The path to the field value (default: `""`).
     * @return {Object} The schema object.
     */
    function sch(obj, out, path) {

        var schema = out || {};
        path = path || "";

        var t = getTypeOf(obj);
        if (t !== "object") {
            return {
                type: t
            };
        } else {
            for (var k in obj) {
                var c = obj[k];
                t = getTypeOf(c);

                if (t === "array" || t === "object") {
                    schema[path + k] = {
                        schema: t === "array" ? sch(c[0]) : sch(c),
                        type: t
                    };
                    continue;
                }

                schema[path + k] = {
                    type: t
                };
            }
        }

        return schema;
    }

    /*!
     * schemaContainsMoreFields
     * Determines if a schema contains other fields (defines an array of objects
     * with one or more fields or an object with one or more fields).
     *
     * @name schemaContainsMoreFields
     * @function
     * @param {Object} schema The schema to analyze.
     * @return {Boolean} True if the schema contains more fields, false otherwise.
     */
    function schemaContainsMoreFields(schema) {
        return (schema.type === "array" &&
                typeof Object(schema.schema).type !== "string") ||
            schema.type === "object";
    }

    /*!
     * schemaCoreFields
     * Sets the core fields in schema.
     *
     * @name schemaCoreFields
     * @function
     * @param {Object} obj The current field object.
     * @param {String} path The path to the field value.
     * @return {undefined}
     */
    function schemaCoreFields(obj, path) {
        path = path || "";
        for (var k in obj) {
            if (!obj.hasOwnProperty(k) || k === ORDER_PROPERTY) continue;

            var c = obj[k];
            var _schemaContainsMoreFields = schemaContainsMoreFields(c);
            // If the schema contains more fields
            if (_schemaContainsMoreFields) {
                // recursively process them
                schemaCoreFields(c.schema, path + k + ".");

            // If the type is not specified but a non-empty array of
            // possible values is specified
            } else if (!c.type && c.possible) {
                // set the type obtained by analyzing the first possible value
                c.type = getTypeOf(c.possible[0]);
            }
            c.label = c.label || k;
            c.path = path + k;
            c.name = k;

            // If the `c` schema contains more fields and it does not have the
            // order of its fields specified,
            if (_schemaContainsMoreFields &&
                    !Array.isArray(Object(c.schema)[ORDER_PROPERTY])) {
                c.schema = c.schema || {};
                // Generate the default order of its fields using Object.keys.
                c.schema[ORDER_PROPERTY] = Object.keys(c.schema);
            }
        }
    }

    /*!
     * getTypeOf
     * Returns the type of input variable.
     *
     * @name getTypeOf
     * @function
     * @param {Anything} o The input variable.
     * @return {String} The type of the input variable.
     */
    function getTypeOf(o) {

        var types = {
            "undefined"                          : "undefined",
            "number"                             : "number",
            "boolean"                            : "boolean",
            "string"                             : "string",
            "[object Function]"                  : "function",
            "[object RegExp]"                    : "regexp",
            "[object Date]"                      : "date",
            "[object Error]"                     : "error"
        };

        if ($.isArray(o)) return "array";
        return types[o && Object.prototype.toString.call(o)] ||
            types[typeof o] || types[o] || (o ? "object" : "null");
    }

    /*!
     * knownElementaryFieldTypes
     * An array with the known field types without `array` and `object`.
     *
     * @name knownElementaryFieldTypes
     * @constant
     * @type {Array}
     * @default
     */
    var knownElementaryFieldTypes = ["number", "boolean", "string", "regexp",
        "date"];

    /*!
     * getDefaultValueForType
     * Returns a default value for the specified schema field type.
     *
     * @name getDefaultValueForType
     * @function
     * @param {String} type The input type string.
     * @return {Anything} The default value for the specified type.
     */
    function getDefaultValueForType(type) {

        return {
            "number" : 0,
            "boolean": false,
            "string" : "",
            "regexp" : new RegExp(""),
            "date"   : new Date(),
            "object" : {},
            "array"  : []
        }[type];
    }

    /**
     * $.fn.jsonEdit
     * Initializes the JSON editor on selected elements.
     *
     * @name $.fn.jsonEdit
     * @function
     * @param {Object} opt_options An object containing the following fields:
     *
     *  - `data` (Object): The input JSON data (default: `{}`).
     *  - `schema` (Object): The JSON data schema. The provided object will be
     *  merged with default schema, which is the one obtained by processing the
     *  `data`.
     *  - `autoInit` (Boolean): If `true`, the forms will be added by default
     *  (default: `true`).
     *
     * @return {Object} The JSON editor object containing:
     *
     *  - `labels` (Object): An object with UI elements used for labels.
     *  - `groups` (Object): An object with UI elements used for groups.
     *  - `inputs` (Object): An object with UI elements used for inputs.
     *  - `container` (jQuery): A jQuery object being the container of the JSON
     *  editor.
     *  - `createGroup` (Function): Creates a form group.
     */
    var JsonEdit = $.fn.jsonEdit = function (opt_options) {

        // Default settings
        var settings = $.extend({
            data: {},
            schema: {},
            autoInit: true
        }, opt_options);

        // JSON Editor object
        var self = {

            // UI
            labels: $.extend(JsonEdit.labels, opt_options.labels),
            groups: $.extend(JsonEdit.groups, opt_options.groups),
            inputs: $.extend(JsonEdit.inputs, opt_options.inputs),
            container: this,

            // Data manipulation
            converters: $.extend(JsonEdit.converters, opt_options.converters),
        };

        /*!
         * createAddButton
         * Returns a new add button to be inserted in a table (the UI for an
         * array).
         *
         * @name createAddButton
         * @function
         * @return The new add button.
         */
        function createAddButton($table) {
            return $("<input>", {
                type: "button",
                val: "+",
                on: {
                    click: function () {
                        var path = $table.attr("data-json-editor-path");
                        self.add($table, self.getData(path + ".+", $table,
                                    true));
                        self.setData(path + ".+", {});
                    }
                },
                "data-json-editor-control": "add"
            });
        }

        /*!
         * createDeleteButton
         * Returns a new delete button to be inserted in a table (the UI for an
         * array).
         *
         * @name createDeleteButton
         * @function
         * @param {jQuery} $table The jQuery element of the table representation
         * of the array for which the delete button is created.
         * @return The new delete button.
         */
        function createDeleteButton($table) {
            return $("<button>", {
                text: "×",
                "data-json-editor-control": "delete",
                on: {
                    click: function () {
                        self.delete($(this).closest("tr"));
                        self.resetPathIndicesInTable($table);
                    }
                }
            });
        }

        /*!
         * deleteColumn
         * Deletes a column from an array table, the column being identified
         * using the `$th` table column header argument which is a jQuery
         * element.
         *
         * @name deleteColumn
         * @function
         * @param {jQuery} $th The header `<th>` of the column which should be
         * deleted.
         * @return {undefined}
         */
        function deleteColumn($th) {
            // Get the table header row, the one which contains `$th`.
            var $tr = $th.closest("tr");
            // Get the index of the column which contains `$th`.
            var i = $th.index();
            // Get the table containing the `$th`.
            var $table = $tr.closest("table");
            // :nth-child selector uses 1-based indices. Select all the
            // table cells with the index (i + 1) inside the parent
            // rows, then remove them from the document.
            $table.find("td:nth-child(" + (i + 1) + ")").remove();
            // Also remove the column header `$th`.
            $th.remove();

            // Also remove the column (field) from the array schema so
            // that the add new field button will work correctly, will
            // not add the deleted field to the new array items.
            var path = $table.attr("data-json-editor-path");
            var name = $th.attr("data-json-editor-name");
            var def = self.getDefinitionAtPath(path);
            // If there is only a single column in the table, its `<th>` will
            // have the `data-json-editor-name` attribute set to an empty
            // string.
            if (name.length > 0) {
                delete def.schema[name];
                var order = def.schema[ORDER_PROPERTY];
                order.splice(order.indexOf(name), 1);
                // If there remains just one column after removing the selected
                // column, move the add/delete item buttons inside the single
                // column, and change the attributes of the rows and of the
                // inputs in the rows so that the `getData` method will not
                // return an array of objects with a single property but an
                // array of elementary objects (strings, numbers, dates etc.).
                // Also update the definition of the array to have its only
                // field's schema directly in the `schema` property.
                if (order.length === 1) {
                    $table.find("tbody > tr").each(function (i, e) {
                        $(e).children("td:last").remove();
                    });
                    $table.find("tfoot > tr").each(function (i, e) {
                        $(e).children("td:last").remove();
                    });
                    addControlsToLastColumn($table);

                    // Update the UI (the table rows in the table body) to
                    // represent the new schema.
                    $table.find("tbody > tr").each(function (i, e) {
                        var $e = $(e);
                        $e.removeAttr("data-json-editor-path");
                        $e.removeAttr("data-json-editor-type");
                        $e.find("[data-json-editor-path]")
                                .each(function (ii, ee) {
                            var $ee = $(ee);
                            var p = $ee
                                .attr("data-json-editor-path");
                            $ee.attr("data-json-editor-path", path + "." + i);
                        });
                    });
                    // Also update the row in the table footer.
                    var $tfootRow = $table.find("tfoot > tr");
                    $tfootRow.removeAttr("data-json-editor-path");
                    $tfootRow.removeAttr("data-json-editor-type");
                    var $tfootInput = $tfootRow.find("[data-json-editor-path]");
                    $tfootInput.attr("data-json-editor-path", path + ".+");
                    // Also update the row in the table header.
                    $table.find("thead:first > tr:first > th:first")
                        .attr("data-json-editor-name", "");

                    def.schema = def.schema[order[0]];
                }
            } else {
                def.schema = {};
                addColumnWithControls($table);
            }
        }

        /*!
         * addColumnWithControls
         * Adds as a last column to the specified jQuery table element a column
         * with an add new item control in the `<tfoot>` row and with delete
         * item controls in each of the rows in the `<tbody>`.
         *
         * @name addColumnWithControls
         * @function
         * @param {jQuery} $table The table jQuery element to which to add the
         * controls.
         * @return {undefined}
         */
        function addColumnWithControls($table) {
            // If the array schema contained a single field, add a new column
            // with the delete item and add item buttons which existed only in
            // the <td>s from the deleted column (or, when adding a new column
            // to a table with a single column, which existed only in the old
            // single column).
            $table.find("tbody > tr").each(function (i, e) {
                $(e).append($("<td>").append(
                            createDeleteButton($table)));
            });
            $table.find("tfoot > tr").each(function (i, e) {
                $(e).append($("<td>").append(
                            createAddButton($table)));
            });
            // TODO: do the same when adding a new field to an array with a
            // single field and do the reverse when adding a new field to an
            // array with no fields.
        }

        /*!
         * addControlsToLastColumn
         * Adds in the last column of the specified jQuery table element
         * controls with an add new item control in the `<tfoot>` row and with
         * delete item controls in each of the rows in the `<tbody>`.
         *
         * @name addControlsToLastColumn
         * @function
         * @param {jQuery} $table The table jQuery element to which to add the
         * controls.
         * @return {undefined}
         */
        function addControlsToLastColumn($table) {
            $table.find("tbody > tr > td:last-child").each(function (i, e) {
                $(e).append(createDeleteButton($table));
            });
            $table.find("tfoot > tr:first > td:last").each(function (i, e) {
                $(e).append(createAddButton($table));
            });
        }

        /*!
         * createDeleteFieldButton
         * Returns a new delete field button to be inserted in a column header
         * in a table with the `deletableFields` schema property set to `true`.
         *
         * @name createDeleteFieldButton
         * @function
         * @return {jQuery} The new delete field button.
         */
        function createDeleteFieldButton() {
            return $("<input>", {
                type: "button",
                value: "× Delete field",
                on: {
                    click: function () {
                        deleteColumn($(this).parent());
                    }
                }
            });
        }

        /*!
         * createColumnHeader
         * Returns a new `<th>` for the specified schema which will be inserted
         * in the table as a column header.
         *
         * @name createColumnHeader
         * @function
         * @param {Object} The schema for which to generate the column header.
         * @return {jQuery} The column header which is a `<th>` element.
         */
        function createColumnHeader(sch) {
            var $th = $("<th>", {
                text: sch.label || "Values",
                "data-json-editor-name": sch.name || ""
            });
            if (sch.deletable) {
                $th.append(createDeleteFieldButton());
            }
            return $th;
        }

        /**
         * createGroup
         * Creates a form group and returns the jQuery object.
         *
         * @name createGroup
         * @function
         * @param {Object} field The field object.
         * @return {jQuery} The jQuery object form.
         */
        self.createGroup = function (field) {

            // Create form group
            var $group = self.groups[field.type].clone(true);

            // TODO Configurable
            var $label = self.labels[field.type].clone(true).text(field.label);
            if (findValue(field, "_edit.key")) {
                $label = self.inputs.string.clone(true).val(field.label);
                $label.attr({
                    "data-json-object-key": "true",
                    "data-json-key-path": field.path
                });
            }

            // Add label
            var $labelContainer = $group.find("label");
            // In fields of type "array" there is no <label> element because it
            // would trigger a click event on buttons inside the table headers
            // when clicking anywhere on the table.
            if ($labelContainer.length === 0) {
                $labelContainer = $group;
            }
            $labelContainer.append($label);

            var fieldData = field.data === undefined ? self.getValue(field.path) : field.data;

            // Add input
            var $input = null;
            if (field.possible) {
                // If the field data is not specified, use a default value.
                if (typeof fieldData === "undefined") {
                    fieldData = getDefaultValueForType(field.type);
                }

                // The input is a `<select>` with multiple possible answers
                // stored in the `field.possible` array.
                $input = $("<select>", {
                    attr: {
                        "data-json-editor-path": field.path,
                        "data-json-editor-type": field.type
                    }
                });

                // Convert the possible values to strings and add them to the
                // `<select>`.
                for (var i = 0; i < field.possible.length; i++) {
                    var val = field.possible[i];
                    var text = JsonEdit.converters.string(val);
                    // For the `value` attribute of the <option> element we do
                    // not use `JsonEdit.converters.string` because the date
                    // string obtained with it cannot be parsed easily with a
                    // general algorithm (for example parsing "22.10.2015" with
                    // the `Date` constructor returns an invalid date) and the
                    // `toString` `Date` method always returns a string
                    // representation of the date in American English
                    // (according to the `Date` `toString` page on
                    // developer.mozilla.org).
                    $input.append($("<option>", {
                        value: val.toString(),
                        text: text
                    }));
                }

                // Set the selected value to the one in `fieldData`.
                $input.val(fieldData);
            } else if (field.type == "array") {
                // If the field data is not specified, use a default value.
                if (typeof fieldData === "undefined") {
                    fieldData = [];
                }

                // TODO Configurable
                var $thead = null;
                var $tfoot = null;
                var $tbody = null;
                var $headers = null;
                var $footers = null;
                $input = $("<table>", {
                    "border": "1",
                    "data-json-editor-path": field.path,
                    "data-json-editor-type": "array"
                }).append([
                    $thead = $("<thead>").append("<tr>"),
                    $tfoot = $("<tfoot>").append("<tr>"),
                    $tbody = $("<tbody>")
                ]);


                $headers = $thead.children("tr");
                var headers = [];
                // headers
                var $ths = [];
                if (typeof Object(field.schema).type === "string") {
                    var sch = field.schema;
                    headers.push(sch.name);
                    if (typeof field.deletableFields === "boolean") {
                        sch = $.extend(true, {}, sch);
                        sch.deletable = field.deletableFields;
                    }
                    var $th = createColumnHeader(sch);
                    $ths.push($th);
                } else {
                    var order = field.schema[ORDER_PROPERTY];
                    for (var i = 0; i < order.length; i++) {
                        var k = order[i];
                        var sch = field.schema[k];
                        headers.push(sch.name);
                        if (typeof field.deletableFields === "boolean") {
                            sch = $.extend(true, {}, sch);
                            sch.deletable = field.deletableFields;
                        }
                        var $th = createColumnHeader(sch);
                        $ths.push($th);
                    }
                }
                if (field.addField) {
                    $ths.push($("<th>").append(createNewFieldEditor({
                        newFields: true,
                        deletableFields: true,
                        editableFields: true,
                        parent: $input
                    })));
                }
                $headers.append($ths);

                // footers (with add new item controls)
                $footers = $tfoot.children("tr");
                var $tdfs = [];
                var $addButton = createAddButton($input);
                // TODO: maybe we should use self.add here too after extending
                // it a bit, in both branches of the `if` structure:
                if (typeof Object(field.schema).type === "string") {
                    var $td = $("<td>");
                    var sch = field.schema;
                    $tdfs.push($td.append(self.createGroup($.extend(true, {}, sch, {
                        type: field.schema.type,
                        // special path for the new edited item:
                        path: field.path + ".+"
                    }))));
                    $td.append($addButton);
                } else {
                    for (var i = 0; i < headers.length; ++i) {
                        var sch = field.schema[headers[i]];
                        // special path for the new edited item:
                        var path = field.path + ".+." + headers[i];

                        // If the schema contains a label
                        if (sch.label) {
                            // we clone the schema and remove the label from the
                            // clone so we do not affect other objects
                            sch = $.extend(true, {}, sch);
                            delete sch.label;
                        }

                        $tdfs.push($("<td>").append(self.createGroup($.extend(true, {}, sch, {
                            path: path
                        }))));
                    }
                    $tdfs.push($("<td>").append($addButton));
                }
                $footers.append($tdfs);

                for (var i = 0; i < fieldData.length; ++i) {
                    self.add($input, fieldData[i]);
                }

            } else if (field.type === "object") {
                // The path attribute is read from the `createNewFieldEditor`
                // function and the type attribute is read from the `setData`
                // and `getData` methods.
                $group.attr({
                    "data-json-editor-path": field.path,
                    "data-json-editor-type": "object"
                });

                $input = [];
                var order = field.schema[ORDER_PROPERTY];
                for (var i = 0; i < order.length; i++) {
                    var k = order[i];
                    var cField = field.schema[k];
                    $input.push(self.createGroup($.extend(true, {}, cField, {
                        path: field.path + "." + k,
                        _edit: field.edit,
                        deletable: field.deletableFields,
                        editable: field.editableFields
                    })));
                }

                if (field.addField) {
                    $input.push(createNewFieldEditor({
                        newFields: true,
                        deletableFields: field.deletableFields,
                        editableFields: field.editableFields,
                        parent: $group
                    }));
                }
            } else {
                // If the field data is not specified, use a default value.
                if (typeof fieldData === "undefined") {
                    fieldData = getDefaultValueForType(field.type);
                }

                $input = self.inputs[field.type].clone(true).attr({
                    "data-json-editor-path": field.path,
                    "data-json-editor-type": field.type
                });

                self.setValueToElement($input, fieldData);
            }

            // Append the created input to the group element, the one returned
            // by the function.
            $labelContainer.append($input);
            // If the field is marked as deletable, add a delete button after
            // its input element.
            if (field.deletable) {
                $labelContainer.append($("<input>", {
                    type: "button",
                    value: "× Delete field",
                    on: {
                        click: function () {
                            // When the Delete field button is clicked, remove
                            // the group element from the document (the group
                            // element contains the input element and the Delete
                            // field button).
                            $group.remove();
                            // Also update the schema in the `settings.schema`
                            // variable. First get the schema of the path
                            // created by removing the last segment of
                            // `field.path`.
                            var sch = self.getDefinitionAtPath(field.path
                                    .split(".").slice(0, -1).join(".")).schema;
                            var order = sch[ORDER_PROPERTY];
                            order.splice(order.indexOf(field.name), 1);
                            delete sch[field.name];
                        }
                    }
                }));
            }
            if (field.editable) {
                $labelContainer.append($("<input>", {
                    type: "button",
                    value: "✎ Edit field",
                    on: {
                        click: function () {
                            // This class, json-editor-edited, indicates that
                            // the field is being edited (with an editor
                            // created with the `createNewFieldEditor` function)
                            // and is used in the `getData` and in the
                            // `nameAlreadyExists` functions to exclude the
                            // edited field from the data and from the list of
                            // duplicate names.
                            $group.find("[data-json-editor-path]")
                                .addClass("json-editor-edited");
                            var $editor = createNewFieldEditor({
                                newFields: false,
                                deletableFields: field.deletable,
                                editableFields: true,
                                parent: $group.closest("[data-json-editor-path]"),
                                editedGroup: $group
                            });
                            $group.after($editor);
                        }
                    }
                }));
            }
            return $group;
        };

        /**
         * getDefinitionAtPath
         * Extracts the part of the `settings.schema` variable at the specified
         * `path`.
         *
         * @name getDefinitionAtPath
         * @function
         * @param {String} path Required, the path at which to get the field
         * definition.
         * @return {Object} The definition of the field at the specified path.
         */
        self.getDefinitionAtPath = function (path) {
            if (path.length === 0) {
                return {
                    schema: settings.schema
                };
            }

            var fieldPathParts = path.split(".");
            var currentPart = fieldPathParts[0];
            var currentVal = settings.schema[currentPart];
            for (var i = 1; i < fieldPathParts.length; i++) {
                currentPart = fieldPathParts[i];
                currentVal = currentVal.schema[currentPart];
            }
            return currentVal;
        };

        /**
         * getNameFromPath
         * Extracts the name of a field from its path.
         *
         * @name getNameFromPath
         * @function
         * @param {String} path Required, the path from which to extract the
         * name.
         * @return {String} The name of the field with the specified path.
         */
        self.getNameFromPath = function (path) {
            return path.split(".").pop();
        };

        /**
         * resetPathIndicesInTable
         * If a table contains these paths: `hobbies.0`, `hobbies.2` without
         * `hobbies.1`, after calling this function, the `hobbies.2` paths will
         * be replaced with `hobbies.1` paths. This function is called afer
         * deleting a row in a table, in a callback in the `add` function.
         *
         * @name resetPathIndicesInTable
         * @function
         * @param {String|jQuery} path A jQuery object indicating the table, or
         * a path to a table.
         * @return {undefined}
         */
        self.resetPathIndicesInTable = function (path) {
            var $table;
            if (path.constructor === jQuery) {
                $table = path;
                path = $table.attr("data-json-editor-path");
            } else {
                $table = $("table[data-json-editor-path='" + path + "']", self.container);
            }

            // For each row in the table
            $table.children("tbody").children("tr").each(function (i, tr) {
                var $tr = $(tr);
                var $firstElementWithPath = $tr
                    .find("[data-json-editor-path]:first");
                // If there is no element with path in this row, it means that
                // this row does not have cells for any column so we can skip
                // it.
                if ($firstElementWithPath.length === 0) {
                    return;
                }
                // get the index in the paths under the current row
                var currentIndex = $firstElementWithPath
                    .attr("data-json-editor-path");
                currentIndex = currentIndex.substring(path.length + 1);
                currentIndex = currentIndex.replace(/\..*$/, "");
                currentIndex = parseInt(currentIndex);
                // if the index in the paths is different than the index of the
                // row
                if (i !== currentIndex) {
                    // for each subelement with a path
                    $tr.find("[data-json-editor-path]").each(function (ii, e) {
                        var newPath = $(e).attr("data-json-editor-path");
                        // replace in the path the old wrong index with the new
                        // index
                        newPath = newPath.replace(new RegExp("\\." +
                                    currentIndex + "\\."), "." + i + ".");
                        newPath = newPath.replace(new RegExp("\\." +
                                    currentIndex + "$"), "." + i);
                        $(e).attr("data-json-editor-path", newPath);
                    });
                }
            });
        };

        /*!
         * createNewFieldEditor
         * Returns a jQuery object containing a new field editor.
         *
         * @name createNewFieldEditor
         * @function
         * @param {Object} options An object containing the following
         * properties:
         *
         * - `newFields` (Boolean): True if the new field editor will create new
         * fields instead of editing existing fields, false otherwise.
         * - `deletableFields` (Boolean): Whether the fields created by this
         * field editor will be deletable.
         * - `editableFields` (Boolean): Whether the fields created by this
         * field editor will be editable.
         * - `parent` (jQuery): Optional. The jQuery element which is the direct
         * parent of all the group elements at the same level as the new field
         * editor destination in the UI and has the `data-json-editor-path`
         * attribute set to the correct path. If it is not set or it does not
         * have this attribute set, the `self.container` element and an empty
         * path string will be used.
         * - `editedGroup` (jQuery): Optional. The jQuery element representing
         * the field which is edited by the newly created field editor. It is
         * required only when `newFields` is set to `false`.
         *
         * @return {jQuery} The newly created field editor.
         */
         function createNewFieldEditor(options) {
            var $parent = options.parent && options.parent.length > 0 ?
                options.parent : self.container;
            var path = $parent.attr("data-json-editor-path") || "";

            var $div = $("<div>", {
                class: "json-editor-" + (options.newFields ? "new" : "edit") +
                    "-field-form"
            });

            var $nameInput = $("<input>", {
                type: "text",
                class: "json-editor-field-name"
            });

            var $possibleValuesSelect = $("<select>", {
                multiple: "multiple",
                class: "json-editor-field-possible-values"
            });

            var $typeSelect = $("<select>", {
                on: {
                    change: function () {
                        var type = $(this).val();
                        var $clone = JsonEdit.inputs[type].clone()
                            .attr("data-json-editor-type", type);
                        $possibleValueInput.replaceWith($clone);
                        $possibleValueInput = $clone;
                        self.setValueToElement($possibleValueInput,
                                getDefaultValueForType(type));
                        $possibleValuesSelect.empty();
                    }
                },
                class: "json-editor-field-type"
            });
            for (var i = 0; i < knownElementaryFieldTypes.length; i++) {
                $typeSelect.append($("<option>", {
                    value: knownElementaryFieldTypes[i],
                    text: knownElementaryFieldTypes[i]
                }));
            }

            var $labelInput = $("<input>", {
                type: "text",
                class: "json-editor-field-label"
            });

            var $possibleValuesDiv = $("<div>", {
                css: {
                    display: "none"
                },
                class: "json-editor-possible-values-section"
            });

            var $checkboxPossibleValues = $("<input>", {
                type: "checkbox",
                on: {
                    change: function (e) {
                        $possibleValuesDiv.toggle(this.checked);
                    }
                },
                class: "json-editor-field-enable-possible-values"
            });

            var $possibleValueInput = $("<input>", {
            });

            var $addPossibleValueButton = $("<input>", {
                type: "button",
                value: "+ Add possible value",
                class: "json-editor-add-possible-value-button",
                on: {
                    click: function () {
                        var val = self.getValueFromElement($possibleValueInput);
                        var text = JsonEdit.converters.string(val);
                        // See the explanation in the `createGroup` method,
                        // `field.possible` if branch, for the reason why we do
                        // not use `JsonEdit.converters.string` for the `value`
                        // attribute of the `<option>` element.
                        $possibleValuesSelect.append($("<option>", {
                            value: val.toString(),
                            text: text
                        }));
                    }
                }
            });

            var $deletePossibleValueButton = $("<input>", {
                type: "button",
                value: "× Delete selected possible values",
                class: "json-editor-delete-possible-value-button",
                on: {
                    click: function () {
                        $possibleValuesSelect.children("option:selected").remove();
                    }
                }
            });

            /*!
             * nameAlreadyExists
             * A function that determines whether the given name already exists
             * in a field under the path in which the user tries to create a new
             * field.
             *
             * @name nameAlreadyExists
             * @function
             * @param {String} name The name of the field to search for.
             * @return {Boolean} True if the name already exists, false
             * otherwise.
             */
            function nameAlreadyExists(name) {
                // If the field editor is not in a table (or, with other words,
                // it is in an object).
                if (!$parent.is("table")) {
                    // Obtain the data at the path where the new field is created.
                    var data = self.getData(path, $parent);

                    // Return true if the given name is already in the data,
                    // otherwise return false.
                    return Object.keys(data).indexOf(name) > -1;
                }
                var sch = self.getDefinitionAtPath(path).schema;
                // If the schema `sch` contains a single field
                if (typeof sch.type === "string") {
                    return name === (sch.name || "values");
                }
                // else if `sch` contains multiple fields
                return sch[ORDER_PROPERTY].indexOf(name) > -1;
            }

            var $addFieldButton = $("<input>", {
                type: "button",
                value: (options.newFields ? "+ Add" : "💾 Save") + " field",
                class: "json-editor-add-field-button",
                on: {
                    click: function () {
                        // Remove dots from the name and remove the whitespace
                        // around it.
                        $nameInput.val($nameInput.val()
                                .replace(/\./g, "").trim());
                        // Remove the whitespace around the label.
                        $labelInput.val($labelInput.val().trim());

                        var name = $nameInput.val();
                        // The default label is the name of the field.
                        var label = $labelInput.val() || name;

                        // Validate the name. It should not be a duplicate, it
                        // should be different than "+" and not an empty string.
                        if (name === "+" || name.length === 0 ||
                                nameAlreadyExists(name)) {
                            alert("The name of the field should be a" +
                                    " non-empty string without dots, " +
                                    "different than \"+\" and not " +
                                    "already existing under the " +
                                    "path \"" + path + "\".");
                            return;
                        }

                        var type = $typeSelect.val();
                        var inTable = $parent.is("table");

                        // Build the schema of the new or modified field.
                        var newSchema = {
                            name: name,
                            label: label,
                            type: type,
                            path: (path ? path + "." : "") + name,
                            deletable: options.deletableFields,
                            editable: options.editableFields,
                            data: getDefaultValueForType(type)
                        };
                        // If the possible values checkbox is enabled, add the
                        // entered possible values to the schema.
                        if ($checkboxPossibleValues.prop("checked")) {
                            var possibleValues = [];
                            var converter = self.converters[newSchema.type];
                            $possibleValuesSelect.children("option").each(
                                function (i, e) {
                                    possibleValues.push(converter($(e).val()));
                                });
                            newSchema.possible = possibleValues;
                        }

                        // Update the schema in the `settings.schema` variable.
                        var definition = self.getDefinitionAtPath(path);
                        var sch = definition.schema;
                        // If the field editor is inside a table
                        if (inTable) {
                            function createNewCellEditor(indexString) {
                                var path2, sch2;
                                path2 = (path ? path + "." : "") + indexString +
                                    "." + name;
                                sch2 = $.extend(true, {}, newSchema, {
                                    path: path2
                                });
                                delete sch2.label;
                                delete sch2.deletable;
                                delete sch2.editable;
                                return $("<td>").append(self.createGroup(sch2));
                            }

                            function addNewColumn($table, newSchema) {
                                // Create and show the UI for the new column in
                                // the table. First add a table column header
                                // then add empty inputs under it.
                                $table.find("thead tr th:last").before(
                                        createColumnHeader(newSchema));
                                var $trs = $table.find("tbody > tr");
                                for (var i = 0; i < $trs.length; i++) {
                                    $trs.eq(i).children("td").eq(-1).before(
                                            createNewCellEditor(i.toString()));
                                }
                                var $tfootRow = $table.find("tfoot > tr:first");
                                $tfootRow.children("td").eq(-1).before(
                                        createNewCellEditor("+"));
                            }

                            // If the schema is not an object with multiple fields,
                            // but a single field,
                            if (typeof sch.type === "string") {
                                // and if the current field editor just creates new
                                // fields (so it does not edit existing fields),
                                if (options.newFields) {
                                    // move the old single field inside a larger
                                    // schema which also contains the newly created
                                    // field.
                                    var nameOfTheSingleOldField = sch.name ||
                                        "values";
                                    definition.schema = {};
                                    definition.schema[ORDER_PROPERTY] =
                                        [nameOfTheSingleOldField, name];
                                    definition.schema[nameOfTheSingleOldField] =
                                        sch;
                                    definition.schema[name] = newSchema;
                                    sch = definition.schema;

                                    schemaCoreFields(sch, definition.path + ".");
                                    // The call to `schemaCoreFields` also sets
                                    // the label to the name "values" in some
                                    // cases, but we can do better, we set it to
                                    // "Values" if `sch` does not have a name
                                    // set.
                                    sch[nameOfTheSingleOldField].label =
                                        sch.name || "Values";

                                    // Update the UI (the table rows in the
                                    // table body) to represent the new schema.
                                    $parent.find("tbody > tr").each(
                                            function (i, e) {
                                        var $e = $(e);
                                        $e.attr({
                                            "data-json-editor-path":
                                                definition.path + "." + i,
                                            "data-json-editor-type": "object"
                                        });
                                        $e.find("[data-json-editor-path]")
                                                .each(function (ii, ee) {
                                            var $ee = $(ee);
                                            var p = $ee
                                                .attr("data-json-editor-path");
                                            $ee.attr("data-json-editor-path",
                                                    p + "." +
                                                    nameOfTheSingleOldField);
                                        });
                                    });
                                    // Also update the row in the table footer.
                                    var $tfootRow = $parent.find("tfoot > tr");
                                    $tfootRow.attr({
                                        "data-json-editor-path":
                                            definition.path + ".+",
                                        "data-json-editor-type": "object"
                                    });
                                    var $tfootInput = $tfootRow.find("[data-json-editor-path]");
                                    $tfootInput.attr("data-json-editor-path",
                                            $tfootInput.attr("data-json-editor-path") +
                                            "." + nameOfTheSingleOldField);
                                    // Also update the row in the table header.
                                    $parent.find("thead:first > tr:first > th:first")
                                        .attr("data-json-editor-name",
                                                nameOfTheSingleOldField);

                                    // Delete the controls from the only column
                                    // of the table because they will be added
                                    // in a new column.
                                    $parent.find("tr > td:nth-child(1) [data-json-editor-control]")
                                        .remove();

                                    // Add a new column with controls (add,
                                    // delete).
                                    addColumnWithControls($parent);

                                    addNewColumn($parent, newSchema);
                                } else {
                                    // TODO: The only field in the table is being
                                    // edited. Not yet implemented.
                                }
                            // else if the schema is an object with multiple fields
                            } else {
                                // A new field is added to a table with multiple
                                // fields.
                                if (options.newFields) {
                                    // First update the schema.
                                    sch[ORDER_PROPERTY].push(name);
                                    sch[name] = newSchema;

                                    addNewColumn($parent, newSchema);
                                // Else an existing field is edited in a table
                                // with multiple fields.
                                } else {
                                    // TODO: Not yet implemented.
                                }
                            }

                        // else if not in a table but in an object
                        } else {
                            // in the `settings.schema` variable store the
                            // schema without the (default) data.
                            var newSchemaWithoutData = $.extend(true, {}, newSchema);
                            delete newSchemaWithoutData.data;
                            var order = sch[ORDER_PROPERTY];
                            // if a new field is created
                            if (options.newFields) {
                                order.push(name);
                            // else if an existing field is edited
                            } else {
                                var oldName = self.getNameFromPath($editedInput
                                        .attr("data-json-editor-path"));
                                delete sch[oldName];
                                order[order.indexOf(oldName)] = name;
                            }
                            sch[name] = newSchemaWithoutData;

                            // Create and show the UI for the schema and add it
                            // before the field editor.
                            $div.before(self.createGroup(newSchema));
                        }

                        // If this editor does not create new fields (it just
                        // edits an existing field), after the UI is created
                        // above, remove the field editor and the old field UI
                        // from the document.
                        if (!options.newFields) {
                            options.editedGroup.remove();
                            $div.remove();
                            return;
                        }

                        // If this editor creates new fields, it should not be
                        // removed from the UI after submitting, so we reset its
                        // values to the default ones.
                        $nameInput.add($labelInput, $typeSelect,
                                $possibleValueInput).val(null);
                        $possibleValuesSelect.empty();
                        $checkboxPossibleValues.prop("checked", false)
                            .trigger("change");
                        $typeSelect.trigger("change");
                    }
                }
            });

            // Call this handler to update the possible value input to the
            // correct type and to clear the possible values list before the
            // possible values from the old schema are inserted in it below.
            $typeSelect.trigger("change");

            // If this condition is met, `options.editedGroup` is a valid jQuery
            // element.
            if (!options.newFields) {
                var $editedInput = options.editedGroup
                    .find("[data-json-editor-path]");
                var fieldPath = $editedInput.attr("data-json-editor-path");
                var oldDef = self.getDefinitionAtPath(fieldPath);

                $typeSelect.val(oldDef.type)
                    .trigger("change");
                $nameInput.val(oldDef.name);
                $labelInput.val(oldDef.label);
                if (oldDef.possible) {
                    $checkboxPossibleValues.prop("checked", true)
                        .trigger("change");
                    for (var i = 0; i < oldDef.possible.length; i++) {
                        var val = oldDef.possible[i];
                        var text = JsonEdit.converters.string(val);
                        // See the explanation in the `createGroup` method,
                        // `field.possible` if branch, for the reason why we do
                        // not use `JsonEdit.converters.string` for the `value`
                        // attribute of the `<option>` element.
                        $possibleValuesSelect.append($("<option>", {
                            value: val.toString(),
                            text: text
                        }));
                    }
                }
            }

            var $label = $("<label>");
            if (!$parent.is("table")) {
                $label.append($("<hr>"));
            }
            var formTitle = (options.newFields ? "Add" : "Edit") + " field";
            $div.append($("<form>").append($label.append(
                    $("<strong>").text(formTitle),
                    $("<br>"),
                    $("<label>").text("Name: ").append($nameInput),
                    $("<label>").text("Type: ").append($typeSelect),
                    $("<label>").text("Label (optional, without final semicolon): ")
                        .append($labelInput),
                    $("<br>"),
                    $("<label>").text("Enable possible values: ")
                        .append($checkboxPossibleValues),
                    $possibleValuesDiv.append($possibleValuesSelect,
                        $possibleValueInput, $addPossibleValueButton,
                        $deletePossibleValueButton),
                    $addFieldButton)));

            // If this is an editor for an existing field,
            if (!options.newFields) {
                // also show a Cancel button.
                $label.append($("<input>", {
                    type: "button",
                    value: "Cancel",
                    on: {
                        click: function () {
                            // There is an edited field which should be marked
                            // as not being edited anymore.
                            $editedInput.removeClass("json-editor-edited");
                            // Delete the field editor from the document.
                            $div.remove();
                        }
                    }
                }));
            }

            return $div;
        }

        /**
         * add
         * Adds new elements in arrays.
         *
         * @name add
         * @function
         * @param {String|jQuery} path The path to the field or the jQuery object.
         * @param {Object} data Data to add.
         * @return {undefined}
         */
        self.add = function (path, data) {
            var $elm = null;
            if (path.constructor === jQuery) {
                $elm = path;
                $elm = $elm.closest("[data-json-editor-path]");
                path = $elm.attr("data-json-editor-path");
            } else {
                $elm = $("[data-json-editor-path='" + path + "']",
                        self.container);
            }

            var fieldSchema = findValue(settings.schema, path);
            var $tbody = $elm.find("tbody");
            // The index of the newly added row, used in the paths
            var nextIndex = $tbody.children().length;
            var $tr = $("<tr>").appendTo($tbody);
            var $deleteButton = createDeleteButton($elm);

            // If the type of the schema is explicitly specified
            if (typeof Object(fieldSchema.schema).type === "string") {
                // then this is an array table with a single column
                var newSchema = $.extend(true, {}, fieldSchema.schema, {
                    type: getTypeOf(data),
                    path: fieldSchema.path + "." + nextIndex,
                    data: data
                });
                delete newSchema.label;
                delete newSchema.deletable;
                delete newSchema.editable;
                $tr.append($("<td>").append(self.createGroup(newSchema),
                            $deleteButton));
            } else if (!$.isEmptyObject(fieldSchema.schema)) {
                // Only set these two attributes if the array to which we are
                // adding a new item is an array of objects, because when it is
                // an array of simple objects, the attributes are already set to
                // the inner input elements inside the table cells.
                $tr.attr({
                    "data-json-editor-type": "object",
                    "data-json-editor-path": path + "." + nextIndex
                });

                // An array with the names of all the fields directly in this
                // schema
                var order = fieldSchema.schema[ORDER_PROPERTY];

                var fields = []; // Field names
                for (var i = 0; i < order.length; i++) {
                    fields.push(fieldSchema.schema[order[i]].name);
                }

                for (var i = 0; i < fields.length; ++i) {
                    // The schema of the current field
                    var sch = fieldSchema.schema[fields[i]];
                    // The path of the current field
                    var currentFieldPath = fieldSchema.path + "." + nextIndex +
                        "." + fields[i];

                    var newSchema = $.extend(true, {}, sch, {
                        path: currentFieldPath,
                        data: data[fields[i]]
                    });
                    delete newSchema.label;
                    delete newSchema.deletable;
                    delete newSchema.editable;
                    $tr.append($("<td>").append(self.createGroup(newSchema)));
                }
                $tr.append($("<td>").append($deleteButton));
            } else { // if ($.isEmptyObject(fieldSchema.schema))
                $tr.append($("<td>").append($deleteButton));
            }
        };

        /**
         * delete
         * Deletes elements from arrays.
         *
         * @name delete
         * @function
         * @param {jQuery} path The <tr> element to be deleted.
         * @return {undefined}
         */
        self["delete"] = function (path) {
            $(path).remove();
        };

        /**
         * getValue
         * Returns the value of field.
         *
         * @name getValue
         * @function
         * @param {String} fieldPath The path to the value.
         * @return {Anything} The value taken from data.
         */
        self.getValue = function (fieldPath) {
            return findValue(settings.data, fieldPath);
        };

        /**
         * getValueFromElement
         * Returns the value of the specified jQuery input element. This is
         * different than the simple jQuery `val` method because it returns a
         * boolean value for inputs of type `checkbox`, it converts the string
         * value of a `date` input to a `Date` object and it does other
         * conversions based on the default or user `converters`.
         *
         * @name getValueFromElement
         * @function
         * @param {jQuery} $el The jQuery input element from which to extract
         * the value.
         * @return {Object} The value of the specified jQuery element.
         */
        self.getValueFromElement = function ($el) {
            var type = $el.attr("data-json-editor-type");

            var val;
            if ($el.attr("type") === "checkbox") {
                val = $el.prop("checked");
            } else {
                // The empty string below is necessary because the jQuery
                // `val` function on fields with possible values (which
                // possibly have the type "string" or "number", present in
                // the UI as <select>s, will return `null` if the set value
                // is not in the list of possible values and the implicit
                // value is `undefined` which may not be one of the possible
                // values. The string converter function called below
                // sometimes expects a non-null value.
                val = $el.val() || "";
            }

            var converter = self.converters[type];
            if (typeof converter === "function") {
                val = converter(val);
            }

            return val;
        }

        /**
         * setValueToElement
         * Sets a value to the specified jQuery input element. This is
         * different than the simple jQuery `val` method because it understands
         * boolean and `Date` values.
         *
         * @name setValueToElement
         * @function
         * @param {jQuery} $input The jQuery input element.
         * @param {Object} val The value to set to the specified input element.
         * @returns {undefined}
         */
        self.setValueToElement = function ($input, val) {
            var type = $input.attr("data-json-editor-type");

            // Set value in input
            if (type === "boolean") {
                $input.prop("checked", val);
            } else if (type === "date") {
                // input[type=date] accepts a UTC date, not a local date.
                // See http://stackoverflow.com/a/32972449/258462
                $input[0].valueAsDate = new Date(Date.UTC(val.getFullYear(),
                            val.getMonth(), val.getDate()));
            } else {
                $input.val(val);
            }
        };

        /**
         * initUi
         * Creates the form from JSON data.
         *
         * @name initUi
         * @function
         * @return {undefined}
         */
        self.initUi = function () {

            function create(obj) {
                var order = obj[ORDER_PROPERTY];
                for (var i = 0; i < order.length; i++) {
                    var c = obj[order[i]];
                    self.container.append(self.createGroup(c));
                }
            }

            create(settings.schema);
        };

        /**
         * setData
         * Sets the specified data to the form input(s) at the specified path.
         *
         * @name setData
         * @function
         * @param {String} path The path of the form input(s) where to set the
         * data.
         * @param {Object} data The data object to set.
         * @param {jQuery} root Optional, the root jQuery element to search for
         * the given path. If not given, defaults to `self.container`.
         * @return {undefined}
         */
        self.setData = function (path, data, root) {
            root = root || self.container;

            // Traverse all the fields in the UI.
            $("[data-json-editor-path]", root).each(function () {
                var $this = $(this);
                var type = $this.attr("data-json-editor-type");
                // If the type is "object", expect that this jQuery `each` loop
                // will reach the inputs representing fields under this object
                // so we do not need to do anything now.
                if (type === "object") return;

                var p = $this.attr("data-json-editor-path");
                // If the current path does not start with the given path,
                // return.
                if (p.substring(0, path.length) !== path) { return; }
                // Remove the given path from the path of the current element.
                p = p.substring(path.length);
                if (p.length > 0) { // If the given path is not a direct value
                    // remove the . character at the beginning
                    p = p.substring(1);
                }

                var val = findValue(data, p);

                // When we deal with an array (in the UI, that means a table),
                // we delete unnecessary table rows and add new necessary table
                // rows, then we return without setting the value (which is a
                // JavaScript array) to the `$this` element  because the values
                // of the rows that are not removed because they are unnecessary
                // will be set in further calls of the jQuery `each` callback,
                // and the newly added rows are added using the `add` method
                // which also sets the values.
                if (type === "array") {
                    var $tbody = $this.children("tbody");

                    // Remove extra unnecessary table rows.
                    $tbody.children("tr").slice(val.length).remove();

                    // Add the remaining new necessary rows using the `add`
                    // method which also sets the values.
                    for (var i = $tbody.children("tr").length; i < val.length;
                            i++) {
                        self.add($this, val[i]);
                    }

                    return;
                }

                // If the value for path `p` is not given, set a default value.
                if (typeof val === "undefined") {
                    val = getDefaultValueForType(type);
                }
                self.setValueToElement($this, val);
            });
        };

        /**
         * getData
         * Collects data from form inputs and return the data object.
         *
         * @name getData
         * @function
         * @param {String} path Optional path at which to collect the data. If
         * not specified, the path will be the root path.
         * @param {jQuery} root Optional root element in which to search for the
         * specified path. If not specified, the root element will be
         * `self.container`. This is useful if the root element has not been
         * appended to `self.container` yet.
         * @param {Boolean} includeNewItemEditors Optional, if true the paths
         * ending in ".+" or containing ".+." will be included in the final data
         * object.
         * @return {Object} The object containing data taken from form inputs.
         */
        self.getData = function (path, root, includeNewItemEditors) {
            path = path || "";
            root = root || self.container;

            var directValue = false;
            var data = {};

            // Traverse all the fields in the UI which are not being edited.
            $("[data-json-editor-path]:not(.json-editor-edited)", root)
                    .each(function () {
                var $this = $(this);
                var type = $this.attr("data-json-editor-type");

                var p = $this.attr("data-json-editor-path");
                // If the current path does not start with the given path (which
                // is by default an empty string), return.
                if (p.substring(0, path.length) !== path) { return; }
                // Remove the given path from the path of the current data in
                // the final data object.
                p = p.substring(path.length);
                // If the given path is not a direct value
                if (p.length > 0 && path.length > 0) {
                    // remove the . character at the beginning
                    p = p.substring(1);
                }

                // If includeNewItemEditors is not true and this is the path of
                // a new item editor in a table, skip.
                if (!includeNewItemEditors && /(\.\+$|\.\+\.)/.test(p)) { return; }

                var val;
                // If `type` is "array" we set the value to an empty array to be
                // sure that an array with no elements will still be in the
                // generated data. The elements of the array will be read from
                // other jQuery elements with paths ending in ".X" or
                // containing ".X." where `X` is a number.
                if (type === "array") {
                    val = [];
                } else if (type === "object") {
                    // Handle objects without fields. (They might have a purpose
                    // if they have the `addField: true` property set.)
                    val = {};
                } else {
                    // If `type` is not an array we read the value from the
                    // jQuery element.
                    val = self.getValueFromElement($this);
                }
                if (p.length > 0) { // If the given path is not a direct value
                    // set the value in the `data` object at the specified
                    // path.
                    data[p] = val;
                } else {
                    // If it is a direct value, at the end of the function we
                    // will return `data` without processing it.
                    directValue = true;
                    data = val;
                }
            });

            // Handle fields with editable names.
            $("[data-json-object-key]", root).each(function () {
                var $this = $(this);
                var path = $this.attr("data-json-key-path");
                var value = data[path];
                delete data[path];
                data[$this.val()] = value;
            });

            if (directValue) {
                return data;
            }
            return handleArrays(unflattenObject(data));
        };

        // Merge schema object
        settings.schema = mergeRecursive(sch(settings.data), settings.schema);

        // Attach core fields to schema objects
        schemaCoreFields(settings.schema);

        // Auto init
        if (settings.autoInit === true) {
            self.initUi();
        }

        return self;
    };

    // Default converter functions
    JsonEdit.converters = {
        boolean: function (value) {
            return (value === true || value === "true" || value === "on" || typeof value === "number" && value > 0 || value === "1");
        },
        string: function (value) {
            if (Object.prototype.toString.call(value) === "[object Date]") {
                return value.toLocaleDateString();
            }
            return value.toString();
        },
        number: function (value) {
            return Number(value);
        },
        regexp: function (value) {
            return new RegExp(value);
        },
        date: function (value) {
            return new Date(value + " UTC");
        }
    };

    // Default group elements
    JsonEdit.groups = {
        "number":   $("<div>").append($("<label>")),
        "boolean":  $("<div>").append($("<label>")),
        "string":   $("<div>").append($("<label>")),
        "regexp":   $("<div>").append($("<label>")),
        "array":    $("<div>"),
        "object":   $("<div>").append($("<label>")),
        "date":     $("<div>").append($("<label>"))
    };

    // Default label elements
    JsonEdit.labels = {
        "number": $("<span>"),
        "boolean": $("<span>"),
        "string": $("<span>"),
        "regexp": $("<span>"),
        "date": $("<span>"),
        "object": $("<h3>"),
        "array": $("<h3>")
    };

    // Default input elements
    JsonEdit.inputs = {
        "number": $("<input>", {type: "number"}),
        "boolean": $("<input>", {type: "checkbox"}),
        "string": $("<input>", {type: "text"}),
        "regexp": $("<input>", {type: "text"}),
        "date": $("<input>", {type: "date"}),
        "array": $("<input>", {type: "text"}),
    };
})($);

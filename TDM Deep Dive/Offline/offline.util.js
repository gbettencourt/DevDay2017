
/*
 * Helper functions for caching objects when the device is offline, and restoring them when back online
 */
OfflineUtil = {

    /*
     * init - accepts an array of operation names to automatically sync when a device comes back online
     */
    init: function(opsToSync) {
        $(window).on("online", function () {
            if (localStorage.length > 0) {
                Td.Util.confirm(
                    "Your internet connection is now active, would you like to sync with the server?",
                    function () {
                        for (var idx = 0; idx < opsToSync.length; idx++) {
                            OfflineUtil.saveOpCachedObjects(opsToSync[idx]);
                        }
                    },
                    function () {
                        var dataToSyncBind = Td.Data.Binding.get("DATA_TO_SYNC");
                        if (dataToSyncBind) {
                            dataToSyncBind.setValue(true);
                        }
                    });
            }
        });
    },

    /*
     * clearOpCache - clear cache for an operation
     */
    clearOpCache: function(opName) {
        localStorage.removeItem(opName);
    },

    /*
     * pushOpCachedObject - queue up an object to save later.  obj is the object to cache (the bind value you would've passed to an operation), objName
     * is the name of the operation it should be passed to later when the device is online.
     */
    pushOpCachedObject: function (obj, opName) {
        //see if cache already exists
        var cacheArray = localStorage.getItem(opName);
        if (cacheArray == null) {
            cacheArray = [];
        }
        else {
            cacheArray = JSON.parse(cacheArray);
        }

        cacheArray.push(obj);
        localStorage.setItem(opName, JSON.stringify(cacheArray));
    },

    /*
     * saveOpCachedObjects - Pass the name of the operation, any cached objects will be restored from the offline cache and passed to the operation
     */
    saveOpCachedObjects: function (opName) {
        var cacheArray = OfflineUtil.getOpCachedObjects(opName);
        if (cacheArray === false) {
            return false;
        }
        var op = Td.Data.Operation.get(opName);
        var objParamName;
        for (pBind in op.paramBinds) {
            objParamName = op.paramBinds[pBind];
            break;
        }
        var objParam = Td.Data.Binding.get(objParamName);
        if (!objParam.array) {
            //we'll need to pass data one at a time
            OfflineUtil.clearOpCache(opName);
            OfflineUtil.chunkArrayData(op, cacheArray, objParamName);
        }
        else {
            //the op supports passing an array, just invoke it
            Td.Data.Binding.get(objParamName).setValue(cacheArray);
            op.invoke();
        }
    },

    /*
     * getOpCachedObjects - Gets an array of the cached objects stored for an operation
     */
    getOpCachedObjects: function (opName) {
        var cacheArray = localStorage.getItem(opName);
        if (cacheArray == null) {
            return false;
        }
        else {
            cacheArray = JSON.parse(cacheArray, OfflineUtil.fixJSONDates);
        }
        return cacheArray;
    },

    /*
     * chunkArrayData - Pops the next cached object off the array, and invokes the operation
     */
    chunkArrayData: function (op, arrayData, paramBindName) {
        if (arrayData.length == 0) {
            OfflineUtil.clearOpCache(op.name);
            return;
        }
        var nextObj = arrayData.shift();
        Td.Data.Binding.get(paramBindName).setValue(nextObj);
        op.invoke({ complete: function () { OfflineUtil.chunkArrayData(op, arrayData, paramBindName); } });
    },

    /*
    * fixJSONDates - When we serialize an object in the offline cache, dates are converted to strings.  This routine converts those strings back to date objects.
    */
    fixJSONDates: function (key, value) {
        if (typeof value === 'string') {
            var a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/.exec(value);
            if (a) {
                return new Date(value);
            }
        }
        return value;
    }
};
/**
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated engine source code (the "Software"), a limited,
 *  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 * to use X9 Group solely to develop games on your target platforms. You shall
 *  not use X9 Group software for developing other software or tools that's
 *  used for developing games. You are not granted to publish, distribute,
 *  sublicense, and/or sell copies of X9 Group.
 * 
 * The software or tools in this License Agreement are licensed, not sold.
 * Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

 const X9OrientedCommand = require('X9OrientedCommand');
 
/**
 * Code Template hỗ trợ một dạng sử dụng với X9 Framework.
 * Sử dụng chuyên cho đa kế thừa (thuộc tính mixins của X9Com và X9Cmd).
 * 
 * Lưu ý:
 * - Sử dụng this.cmd(...) để gửi payload
 * - Override allowCommandTypes() để khai báo các dạng type được phép nhận command sử dụng.
 * - Template chỉ có tác dụng khi không có hàm reduce trong khai báo class.
 */
var X9AutoReduceStyle = cc.Class({
    mixins: [X9OrientedCommand],

    statics: {
        STATE_ID_ARG: "__state_id__"
    },

    ctor(){
        this._applyToSubclass = true;
        this._lastState = null;
        this._asyncViewCmds = [];
        this._exportData = null;
        this._exportError = null;
        this._asyncViewTasks = Object.create(null);
    },

    //--------- State Deep Comparing ------------

    /**
     * 
     * @param {*} value 
     */
    applyStateDeepComparing(value){
        this._deepCompare = value;
    },

    //----------private command --------------------


    /**
     * Mặc định true, cho phép các sub class nhận được private command từ các command nhắm đến super class được chỉ định trong payload.
     * Nếu false chỉ class được chỉ định trong payload
     * @param {*} boolean 
     */
    applyPrivateCommandToSubclass(trueOrFalse){
        if(this instanceof cc.Component){
            this._applyToSubclass = trueOrFalse
        }else{
            throw new Error(this.__className + "::applyPrivateCommandToSubclass(trueOrFalse) : " +" Chỉ gọi trong Subclass của X9Com")
        }
    },

    getStateType(){
        let state = this.getState();
        return state && state[X9OrientedCommand.TYPE_ARG] ? state[X9OrientedCommand.TYPE_ARG] : 'default';
    },

    getStateId(){
        let state = this.getState();
        return state && state[X9AutoReduceStyle.STATE_ID_ARG] ? state[X9AutoReduceStyle.STATE_ID_ARG] : 1;
    },

    getError(){
        let state = this.getState();
        return state && state[X9OrientedCommand.ERROR_ARG] ? state[X9OrientedCommand.ERROR_ARG] : null;
    },

    export(){
        let exportData = this._exportData && (typeof(this._exportData) === 'object') ? this._exportData : null;
        if(this._exportError){
            exportData = exportData ? exportData : Object.create(null);
        }
        if(exportData) {
            exportData[X9OrientedCommand.ERROR_ARG] = this._exportError ? this._exportError : null;        
        }
        return exportData;
    },

    exportError(errorId, message){
        this._exportError = Object.create(null);
        this._exportError.id = errorId;
        this._exportError.msg = message;
    },
    
    //----------- OVERRIDE ------------------------
    // 
    //---------------------------------------------

    /**
     * 
     * @param {*} state 
     * @param {*} payload 
     */
    reduce(state, payload){        
        if(this instanceof cc.Component){
            if(!payload) return state;
            if(payload[X9OrientedCommand.CLASS_ARG] && !this._isPrivateForThis(payload)){
                return state;
            }else{
                // let newState = (this.allowCommandTypes().indexOf(payload[X9OrientedCommand.TYPE_ARG]) !== -1)  ? Object.assign(Object.create(null), state, payload) : state;
                // let newState = (this.allowCommandTypes().indexOf(payload[X9OrientedCommand.TYPE_ARG]) !== -1)  ? this._deepCompare ? Object.assign(state, payload) : Object.assign(Object.create(null), state, payload) : state;
                let newState;
                if(this.allowCommandTypes().indexOf(payload[X9OrientedCommand.TYPE_ARG]) !== -1){                    
                    let mergedPayload = this._mergeExportDataToPayload(payload);
                    if(this._deepCompare){
                        newState = Object.assign(state, mergedPayload);
                    }else{
                        newState = Object.assign(Object.create(null), state, mergedPayload);
                    }
                    //
                    // STATE_ID_ARG
                    let stateId = this.getStateId();
                    stateId++;
                    stateId = (stateId == Number.MAX_SAFE_INTEGER) ? 1 : stateId;
                    newState[X9AutoReduceStyle.STATE_ID_ARG] = stateId;
                    //
                }else{
                    newState = state;
                }
                // Xóa data export để cập nhật data mới.
                this._exportData = null;
                this._exportError = null;
                // 
                return newState;
            }            
        }else{
            throw new Error(this.__className + "::reduce(state, payload) : " +" Chỉ gọi trong Subclass của X9Com");
        }
        return state;
    },


    /**
     * 
     * @param {*} newState 
     */
    onChange(newState){
        if(this instanceof cc.Component){
            if(newState) {
                //
                let stateType = newState[X9OrientedCommand.TYPE_ARG];
                this._exportData = this.onUpdateState(this._prepareUpdatingState(newState));                
                if( this._asyncViewCmds && this._asyncViewCmds.indexOf(stateType) == -1){
                    this._excuteViewTasks(stateType, (stateId)=>{
                        // ket thuc xu ly view
                        this.clearThenEndUp(stateId);
                        CC_DEBUG && cc.log('End Task View ' + (this.__className ? this.__className : this.constructor.name)); 
                    });
                }
            }
        }else{
            throw new Error(this.__className + "::onChange(newState) : " +" Chỉ gọi trong Subclass của X9 Components")
        }
    },

    /**
     * Danh sách các kiểu command được chấp nhận.
     * Các command được chấp nhận là các command làm thay đổi state của component.
     * @returns Trả về Array<String> các command type được chấp nhận.
     */
    allowCommandTypes(){        
        if(this instanceof cc.Component){
            return ['default'];
        }else{
            throw new Error(this.__className + "::allowCommandTypes() : " +" Chỉ gọi trong Subclass của X9Com");
        }
        return null;
    },

    //--------- State Deep Comparing ------------

    /**
     * 
     * @param {*} lastState 
     * @param {*} newState 
     */
    areEqual(lastState, newState){
        if(this instanceof cc.Component){
            if(this._deepCompare){         
                let newSateJson = newState ? JSON.stringify(newState) : this._lastState;
                let isEqual = (newSateJson === this._lastState)
                if(!isEqual) {
                    this._lastState = newSateJson;
                };
                return isEqual;
            }else{
                return lastState === newState;
            }            
        }
    },


    clearThenEndUp(stateId){
        let currentStateId = this.getStateId();
        let state = this.getState();
        if(stateId == currentStateId){
            this._clearPrivateArgs(state);
        }
    },

    //----------------------------------
    //  PRIVATE FUNCTION
    //----------------------------------

    //----------private command --------------------

    _clearPrivateArgs(state){
        if(state){
            delete state[X9OrientedCommand.TYPE_ARG];
            delete state[X9OrientedCommand.CLASS_ARG];
            delete state[X9OrientedCommand.ERROR_ARG];
        }
    },

    /**
     * 
     * @param {*} payload 
     */
    _isPrivateForThis(payload){        
        if(payload && payload[X9OrientedCommand.CLASS_ARG]){
            let isTheSameClass = (payload[X9OrientedCommand.CLASS_ARG] == this.__className);
            if(isTheSameClass) return true;
            let targetClass = cc.js.getClassByName(payload[X9OrientedCommand.CLASS_ARG]);
            if(!targetClass || !this._applyToSubclass) return false;
            let currentClass = cc.js.getClassByName(this.__className);                        
            return cc.js.isChildClassOf(currentClass, targetClass);
        }
        return false;
    },

    /**
     * Đồng bộ các exported data từ các component được use.
     * Nếu component được used không có export data thì bỏ qua.
     * Công việc này điều khiển luồng dữ liệu theo thứ tự xử lý dữ liệu của các x9Comp được use.
     * @param {*} payload 
     */
    _mergeExportDataToPayload(payload){
        if(this._waitIds && this._waitIds.length){
            let mergedPayload = payload;
            this._waitIds.forEach(token => {
                if(this._getUsedComponentByToken){
                    let comp = this._getUsedComponentByToken(token);
                    if(comp){
                        let exportData = comp.export();
                        mergedPayload = exportData ? Object.assign(mergedPayload, exportData) : mergedPayload;
                    }
                }
            });
            return mergedPayload;
        }
        return payload
    },

    /**
     * 
     * @param {*} cmdType 
     * @param {*} endTask 
     */
    _excuteViewTasks(cmdType, endTask){
        if(this._asyncViewTasks && this._asyncViewTasks[cmdType] && this._asyncViewTasks[cmdType].length){
            // 
            let asyncTasks = this._asyncViewTasks[cmdType].slice();
                if(asyncTasks.indexOf(this) == -1 && asyncTasks.indexOf(this.__className) == -1){
                    asyncTasks.push(this);
                }
                asyncTasks.push(endTask);
                asyncTasks.reduce( (accumulatorPromise, nextID) => {  
                    return accumulatorPromise.then(() => {                        
                        return ((x9CompName)=>{
                            const x9Comp = (x9CompName === this) ? x9CompName : ( (typeof(x9CompName) !== 'function') ? this.use(x9CompName) : null );
                            const x9CompStateId = x9Comp ? x9Comp.getStateId() : null;
                            return new Promise((resolve, reject) => {
                                if( x9Comp && x9Comp.onUpdateView && (x9Comp.getError() == null) ){
                                    // Có lỗi không vào view nữa.
                                    x9Comp.onUpdateView(resolve);
                                    x9Comp.clearThenEndUp(x9CompStateId);
                                }else{
                                    // endTask
                                    resolve();
                                }
                            });
                        })(nextID);
                    });
                }, Promise.resolve());
        }else{
            const lastStateId = this.getStateId();
            if(this.getError() == null){
                this.onUpdateView(()=>{                    
                    endTask(lastStateId);
                });
            }else{
                endTask(lastStateId);
            }
        }
        // 
    },

    /**
     * Xử lý các State được báo lỗi.
     * @param {*} newState 
     */
    _prepareUpdatingState(newState){
        if(newState && newState[X9OrientedCommand.ERROR_ARG]){            
            let resolvedState = this.onPreUpdateState(newState);
            // delete newState[X9OrientedCommand.ERROR_ARG];
            return resolvedState && (typeof(resolvedState) === 'object') ? resolvedState : newState;
        }        
        return newState;
    },
  
    //------------------ Sequence View Updating--------------------------
    // Render view theo thứ tự
    //-----------------------------------------------------------
    
    /**
     * 
     * @param {*} cmdType 
     */
    allowAsyncViewWithCMD(cmdType){
        if(this._asyncViewCmds && this._asyncViewCmds.indexOf(cmdType) == -1){            
            this._asyncViewCmds.push(cmdType);
        }
    },

    /**
     * 
     * @param {*} cmdType 
     * @param  {...any} args 
     */
    sequence(cmdType, ...args){        
        var taskView = [];
        for (let index = 0; index < args.length; index++) {
            let x9CompName = args[index];
            let x9Comp = this.use(x9CompName);
            // Đăng ký update view theo thứ tự sau khi data trả về từ cmd.
            if(x9Comp && (x9CompName != this.__className)){
                if(x9Comp.onUpdateView){            
                    x9Comp.allowAsyncViewWithCMD(cmdType);
                    if((taskView.indexOf(x9CompName) == -1) /* && (x9CompName != this.__className) */){
                        taskView.push(x9CompName);
                    }
                }else{
                    throw new Error("" + x9CompName + " không sử dụng X9 Auto Reduce Coding Style.");
                }
            }else{
                throw new Error("Chuỗi update view lần lượt chỉ dùng cho các x9 component được tham chiếu.");
                continue;
            }
        }
        this._asyncViewTasks[cmdType] = taskView;
    },

    //--------------------------------------------\

     /**
     * Luồng gọi trước onUpdateState. Nhiệm vụ là bắt các error và warning. Fixed state data và trả về state data đã được fixed.
     * Nếu ko trả về hoặc trả về null thì sẽ không gọi vào onUpdateState.
     * @param {*} newState 
     */
    onPreUpdateState(newState){
        return newState;
    },  
    
    /**
     * 
     * @param {*} savedState  // State mới sau khi được merge payload và đã được xử lý khi có lỗi tại onPreUpdateState.
     */
    onUpdateState(savedState){
        return true;
    },
    
       
    /**
     * Hàm gọi ra khi mỗi lần có cmd pass qua các bước lọc allowCommandTypes > onPublic/onPrivate Command > onUpdateView
     * 
     * @param {String} stateType 
     */
    onUpdateView(done){
        // override  dùng với this.getStateType() để lấy trạng thái hiện thời.
        if(done){
            done();
        }
    }

})
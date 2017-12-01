/* globals L:true */

L.Edit = L.Edit || {};

L.Draw.Event.CREATEFG = 'draw:createfg';

L.FeatureGroup.prototype.setStyle = function (style) {
    L.FGUtils.setStyle(this, style);
};

/**
 * @class L.Edit.Rectangle
 * @aka Edit.Rectangle
 * @inherits L.Edit.SimpleShape
 */
L.Edit.FeatureGroup = L.Edit.Rectangle.extend({
	initialize: function (shape, options) {
        this.type = 'featuregroup';
        
        L.Edit.Rectangle.prototype.initialize.call(this, shape, options);
    },
    
	_onMarkerDragStart: function (e) {
		L.Edit.Rectangle.prototype._onMarkerDragStart.call(this, e);
        this._oppositeCornerIndex = e.target._cornerIndex;
	},

	_move: function (newCenter) {
		var originalCenter = this._shape.getBounds().getCenter();
            
        // Offset the latlngs to the new center
		// but enforce move to be inside our maxBounds
        var okToMove = true;
        var bbounds = this._map.options.maxBounds;
        if (bbounds) {
            okToMove = L.FGUtils.checkMoveFeatureGroup(this._shape, newCenter, bbounds);
        }
        
        // only move if *all* member shapes are still in the maxbounds after the move
		if (okToMove) { 
            L.FGUtils.moveFeatureGroup(this._shape, newCenter);

            // Reposition the resize markers
            this._repositionCornerMarkers();
            this._moveMarker._latlng = newCenter;
            this._moveMarker.update();

            this._map.fire(L.Draw.Event.EDITMOVE, {
                layer: this._shape,
                newCenter: newCenter,
                originalCenter: originalCenter,
                editType: 'editfg/Move',
                editHandler: this
            });
        }
        else {
            this._moveMarker._latlng = originalCenter;
            this._moveMarker.update();
        }
	},

    // different than rect
	_resize: function (latlng) {
        var bbounds = this._map.options.maxBounds;
		var originalBounds = this._shape.getBounds();
        
		// Update the shape based on the current position of this corner and the opposite point
        
        var newBounds = L.LatLngUtil.makeBounds(latlng, this._oppositeCorner);
        
        if (bbounds && !L.FGUtils.checkResizeFeatureGroup(this._shape, originalBounds, newBounds, bbounds)) {
            return;
        }
        
        L.FGUtils.resizeFeatureGroup(this._shape, newBounds, this._oppositeCorner, this._oppositeCornerIndex);
        
		// Reposition the move marker
		this._moveMarker._latlng = this._shape.getBounds().getCenter().clone();
        this._moveMarker.update();

		this._map.fire(L.Draw.Event.EDITRESIZE, {
            layer: this._shape,
            originalBounds: originalBounds,
            oppositeCorner: this._oppositeCorner,
            oppositeCornerIndex: this._oppositeCornerIndex,
            newBounds: newBounds,
            editType: 'editfg/Resize',
            editHandler: this
        });
	},
});

L.Edit.FeatureGroup.resizeEditFG = function(undoManager, layer, bounds, corner, cornerIndex) {
    var editHandler = undoManager._getEditHandler(layer);
    L.FGUtils.resizeFeatureGroup(layer, bounds, corner, cornerIndex);
    editHandler._moveMarker._latlng = layer.getBounds().getCenter().clone();
    editHandler._moveMarker.update();
    editHandler._repositionCornerMarkers();
};

/*
    'enable': function (undoManager) {
        undoManager._map.on('styleeditor:setLayoutRule', TCR.Style.RuleController.undoExtension.processEvent, undoManager);
        undoManager._map.on('styleeditor:finalizeLayoutRule', TCR.Style.RuleController.undoExtension.finalizeEvent, undoManager);
        undoManager._map.on('styleeditor:revertLayoutRule', TCR.Style.RuleController.undoExtension.revertEvent, undoManager);
    },
    
    'disable': function (undoManager) {
        undoManager._map.off('styleeditor:setLayoutRule', TCR.Style.RuleController.undoExtension.processEvent, undoManager);
        undoManager._map.off('styleeditor:finalizeLayoutRule', TCR.Style.RuleController.undoExtension.finalizeEvent, undoManager);
        undoManager._map.off('styleeditor:revertLayoutRule', TCR.Style.RuleController.undoExtensionr.revertEvent, undoManager);
    },
    
    // this = undoManager
    'finalizeEvent': function (e) {
        this.stateHandler.finalizeTag(e.tag, false, 'originalValues');
    },
    
    // this = undoManager
    'revertEvent': function (e) {
        this.stateHandler.finalizeTag(e.tag, true, null);
    },
    
    // this = undoManager
    'processEvent': function (e) {
        this.stateHandler.pushUndo(L.Draw.Event.ID, 'setLayoutRule', e, e.tag);
    },
*/




L.Edit.FeatureGroup.fgUndoExtension = {
    'undoMain': function (undoManager, type, params) {
        if (type == 'editfg/Resize') {
            L.FGUtils.resizeFeatureGroup(params.layer, params.original.originalBounds, params.original.oppositeCorner, params.original.oppositeCornerIndex);
            return true;
        }
        else if (type == 'editfg/Move') {
            L.FGUtils.moveFeatureGroup(params.layer, params.original.originalCenter);
            return true;
        }
        
        return false;
    },
    
    'redoMain': function (undoManager, type, params) {
        if (type == 'editfg/Resize') {
            L.FGUtils.resizeFeatureGroup(params.layer, params.newBounds, params.oppositeCorner, params.oppositeCornerIndex);
            return true;
        }
        else if (type == 'editfg/Move') {
            L.FGUtils.moveFeatureGroup(params.layer, params.newCenter);
            return true;
        }
        
        return false;
    },
    
    'undoNested': function (undoManager, type, params) {
        if (type == 'editfg/Resize') {
            L.Edit.FeatureGroup.resizeEditFG(undoManager, params.layer, params.original.originalBounds, params.original.oppositeCorner, params.original.oppositeCornerIndex);
            return true;
        }
        else if (type == 'editfg/Move') {
            this.eventBlock ++;
            var editHandler = this._getEditHandler(params.layer);
            editHandler._move(params.original.originalCenter);
            return true;
        }
        
        return false;
    },
    
    'redoNested': function (undoManager, type, params) {
        if (type == 'editfg/Resize') {
            L.Edit.FeatureGroup.resizeEditFG(undoManager, params.layer, params.newBounds, params.oppositeCorner, params.oppositeCornerIndex);
            return true;
        }
        else if (type == 'editfg/Move') {
            this.eventBlock ++;
            var editHandler = this._getEditHandler(params.layer);
            editHandler._move(params.newCenter);
            return true;
        }
        
        return false;
    },
};

L.FeatureGroup.addInitHook(function () {
	if (L.Edit.FeatureGroup) {
        this._scaleSet = null;
		this.editing = new L.Edit.FeatureGroup(this);

		if (this.options.editable) {
			this.editing.enable();
		}
	}
    
    this.on('add', function (e) {
        var bounds = this.getBounds();
        if (bounds.hasOwnProperty('_southWest')) {
            this._originalWidth = (bounds.getWest() - bounds.getEast());
            this._originalHeight = (bounds.getNorth() - bounds.getSouth());
        }
        else {
            this._originalWidth = 0;
            this._originalHeight = 0;
        }
    }, this);
    
    var $this = this;
    this.redraw = function () {
        $this.eachLayer(function (layer) {
            if (layer.hasOwnProperty('redraw')) {
                layer.redraw();
            }
        });
    };
});

L.Handler.FeatureGroupSnap = L.Edit.FeatureGroup.extend({
    initialize: function (map, shape, options) {
        L.Edit.FeatureGroup.prototype.initialize.call(this, shape, options);
        this._snapper = new L.Handler.MarkerSnap(map, options);
        L.FGUtils.markFGChildren(shape);
    },
    
    _createMarker: function (latlng, icon) {
        var marker = L.Edit.FeatureGroup.prototype._createMarker.call(this, latlng, icon);
        this._shape.snapediting._snapper.watchMarker(marker);
        marker._topOwner = this._shape._topOwner;
        return marker;
    },
    
    addGuideLayer: function (layer) {
        this._snapper.addGuideLayer(layer);
    },
});
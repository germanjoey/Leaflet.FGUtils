/* global L:true */

// API:
//
// NOTE: although this library is called "L.FGUtils" and the code and documentation always refers to
//     Feature Groups, all of these functions should also be completely fine with L.LayerGroups.
//
// L.FGUtils.redimensionFeatureGroup (fg, bbN)
//     function
//
//     force the Feature Group 'fg' to the size of the bounding box 'bbN'. if the ratio of the area of
//     bbN/fg.getBounds() is roughly 1 (according to L.FGUtils.RedimensionMoveRatio), then
//     L.FGUtils.moveFeatureGroup will be called. otherwise, L.FGUtils.resizeFeatureGroup will be
//     called with fixedCornerPoint/fixedCornerIndex being the one determined to be closest to its
//     corresponding corner in bbN.
//
// L.FGUtils.checkMoveFeatureGroup (fg, newCenter, maxBounds)
//     function
//
//     returns true if the Feature Group 'fg' will remain inside 'maxBounds' if it is moved to 'newCenter'.
//     otherwise, returns false.
//
// L.FGUtils.moveFeatureGroup (fg, newCenter)
//     function
//
//     move the Feature Group 'fg' from its current position to the 'newCenter' latlng coordinate
//
// L.FGUtils.checkResizeFeatureGroup (fg, bbO, bbN, maxBounds)
//     function
//
//     checks two conditions; returns true if both are met, and otherwise false. first, the function checks
//     if the Feature Group 'fg' with bounding box 'bbO' will successfully scale to 'bbN' without going outside
//     of the bounding box 'maxBounds'. the second condition is that the ratio of the area of bbN to bbO
//     must be greater than or equal to L.FGUtils.MinimumResizeRatio (default of 10%)
//
// L.FGUtils.resizeFeatureGroup (fg, bbN, fixedCornerPoint, fixedCornerIndex)
//     function
//
//     scale the Feature Group 'fg' to match size 'bbN', scaling each of fg's layers by the ratio of area
//     between bbN/fg.getBounds(). 'fixedCornerPoint' specifies the corner of the Feature Group that should
//     remain in place. 'fixedCornerIndex' is the index of this corner, according to nw=0, ne=1, se=2, sw=3.
//    
// L.FGUtils.markFGChildren (fg, idx)
//     function
//
//     mark the '_topOwner' property of every child and sub-child of a Feature Group 'fg' with the value 'idx'.
//
// L.FGUtils.setStyle (fg, style)
//     function
//
//     apply 'style' to the Feature Group 'fg' without affecting its internal layers. specifically, this function
//     will add a transparent box '_styler' as the topmost layer of the Feature Group and set the style on that.
// 
// L.FGUtils.RedimensionMoveRatio
//     variable setting
//
//     if the difference in ratio of the old bounding box to the new bounding box is less than this, (defaulting
//     to +/- 1% difference), L.FGUtils.redimensionFeatureGroup will perform a "move" rather than a "resize+move"
//     
// L.FGUtils.MinimumResizeRatio
//     variable setting
//
//     the minimum ratio necessary for L.FGUtils.checkResizeFeatureGroup to consider that it is
//     worth resizing to, under the assumption that you won't want to bother resizing to very tiny sizes
//
//
// NOTE:
// feel free to use any other function in this library, but note that it is not part of the "official" API for L.FGUtils

L.FGUtils = {};

L.FGUtils.RedimensionMoveRatio = 0.01;
L.FGUtils.MinimumResizeRatio = 0.1;

/* ************************************************************************************************************************/

L.FGUtils.moveFeatureGroup = function (fg, newCenter) {
    var oldCenter = fg.getBounds().getCenter();
    var moveLat = newCenter.lat - oldCenter.lat;
    var moveLng = newCenter.lng - oldCenter.lng;
    
    fg.eachLayer(function (layer) {
        L.FGUtils.moveFGSubLayer(layer, moveLat, moveLng);
    });
    fg.fire('move');
};

L.FGUtils.moveFGSubLayer = function (layer, moveLat, moveLng) {
    var newSubCenter = L.FGUtils.getSubLayerCenter(layer).clone();
    newSubCenter.lat += moveLat;
    newSubCenter.lng += moveLng;
    
    if (layer instanceof L.Marker) {
        layer.setLatLng(newSubCenter);
    }
    else if (layer instanceof L.Polyline || layer instanceof L.Rectangle || layer instanceof L.Polygon) {
        var latlngs = layer.getLatLngs();
        var isFlat = L.LineUtil.isFlat(latlngs);
        var loopLatLngs = isFlat ? latlngs : latlngs[0];
        
        for (var i=0; i<loopLatLngs.length; i++) {
            loopLatLngs[i].lat += moveLat;
            loopLatLngs[i].lng += moveLng;
        }
        
        layer.setLatLngs(isFlat ? loopLatLngs : [loopLatLngs]);
    }
    else if (layer instanceof L.Circle) {
        layer.setLatLng(newSubCenter);
    }
    else if (layer instanceof L.FeatureGroup) {
        L.FGUtils.moveFeatureGroup(layer, newSubCenter);
    }
};

L.FGUtils.checkResizeFeatureGroup = function (fg, bbO, bbN, maxBounds) {
    bbO = bbO || fg.getBounds();
    if (maxBounds.contains(bbN.getNorthWest()) && maxBounds.contains(bbN.getNorthEast())
     && maxBounds.contains(bbN.getSouthWest()) && maxBounds.contains(bbN.getSouthEast())) {
        var deltaSize = L.FGUtils.getDeltaScale(bbO, bbN);
        if (deltaSize > L.FGUtils.MinimumResizeRatio) {
            return true;
        }
    }
    
    return false;
};

L.FGUtils.getDeltaScale = function (bbO, bbN) {
    return (bbN.getWest() - bbN.getEast())/(bbO.getWest() - bbO.getEast());
};

L.FGUtils.resizeFeatureGroup = function (fg, bbN, fixedCornerPoint, fixedCornerIndex) {
    var bbO = fg.getBounds();
    var scale = L.FGUtils.getDeltaScale(bbO, bbN);
    
    fg.eachLayer(function (layer) {
        L.FGUtils.scaleFGSublayer(layer, scale, bbO, bbN);
    });
    
    L.FGUtils.setResizeFix(fg, fixedCornerPoint, fixedCornerIndex);
    fg.fire('edit');
};

L.FGUtils.setResizeFix = function (fg, fixedCornerPoint, fixedCornerIndex) {
    if (!fixedCornerPoint) {
        return;
    }
    
    // index = nw, ne, se, sw
    // BUT REMEMBER - we're gonna be dealing with the *opposite* corner here!
    
    var bbX = fg.getBounds();
    var diffLat;
    var diffLng;
    
    if ((fixedCornerIndex === 0) || (fixedCornerIndex === 1)) {
        diffLat = fixedCornerPoint.lat - bbX.getSouth();
    }
    else {
        diffLat = fixedCornerPoint.lat - bbX.getNorth();
    }
    
    if ((fixedCornerIndex == 1) || (fixedCornerIndex == 2)) {
        diffLng = fixedCornerPoint.lng - bbX.getWest();
    }
    else {
        diffLng = fixedCornerPoint.lng - bbX.getEast();
    }
    
    var xCenter = bbX.getCenter();
    var correctCenter = new L.LatLng(xCenter.lat + diffLat, xCenter.lng + diffLng);
    L.FGUtils.moveFeatureGroup(fg, correctCenter);
};

L.FGUtils.getSubLayerCenter = function (layer) {
    if (layer instanceof L.Marker || layer instanceof L.Circle) {
        return layer.getLatLng();
    }
    else if (layer instanceof L.FeatureGroup) {
        return layer.getBounds().getCenter();
    }
    
    return layer.getCenter();
};
    
L.FGUtils.scaleFGSublayer = function (layer, scale, bbO, bbN) {
    var newSubCenter = L.FGUtils.findScaledSubCenter(layer, scale, bbO, bbN);
            
    if (layer instanceof L.Marker) {
        layer.setLatLng(newSubCenter);
    }
    else if (layer instanceof L.Polyline || layer instanceof L.Rectangle || layer instanceof L.Polygon) {
        var latlngs = layer.getLatLngs();
        for (var i=0; i<latlngs.length; i++) {
            L.FGUtils.scaleLatLngs(layer, scale, newSubCenter, latlngs[i]);
        }
        layer.setLatLngs(latlngs);
    }
    else if (layer instanceof L.Circle) {
        layer.setLatLng(newSubCenter);
        layer.setRadius(layer.getRadius()*scale);
    }
    else if (layer instanceof L.FeatureGroup) {
        var subBounds = layer.getBounds();
        var scaledSubBounds = L.FGUtils.adjustFGSubBBox(subBounds, scale, newSubCenter);
        L.FGUtils.resizeFeatureGroup(layer, scaledSubBounds);        
    }
    else {
        throw("Cannot scale unknown layer type!");
    }
};

L.FGUtils.findScaledSubCenter = function (layer, scale, bbO, bbN) {
    var centerO = bbO.getCenter();
    var centerN = bbN.getCenter();
    
    var centerP = L.FGUtils.getSubLayerCenter(layer);
    if (centerP.equals(centerO)) {
        return centerN;
    }
    
    var signLat = (centerP.lat > centerO.lat) ? 1 : -1;
    var signLng = (centerP.lng > centerO.lng) ? 1 : -1;
    
    var distHO = centerP.distanceTo(centerO);
    var distAO = Math.abs(centerP.lng - centerO.lng);
    var angle = Math.acos(distAO/distHO);
    
    var distHN = distHO*scale;
    var distLat = Math.sin(angle)*distHN;
    var distLng = Math.cos(angle)*distHN;
    
    return new L.LatLng(centerN.lat + signLat*distLat, centerN.lng + signLng*distLng);
};

L.FGUtils.scaleLatLngs = function (layer, scale, newSubCenter, latlngs) {
    var layerCenter = layer.getCenter();
    for (var i=0; i<latlngs.length; i++) {
        latlngs[i].lat = (latlngs[i].lat - layerCenter.lat)*scale + newSubCenter.lat;
        latlngs[i].lng = (latlngs[i].lng - layerCenter.lng)*scale + newSubCenter.lng;
    }
};

L.FGUtils.adjustFGSubBBox = function (subBounds, scale, newSubCenter) {
    var sbc = subBounds.getCenter().clone();
    var scaledSubBounds = subBounds.pad((scale-1)/2);
    
    var diffLat = newSubCenter.lat - sbc.lat;
    var diffLng = newSubCenter.lng - sbc.lng;
    
    scaledSubBounds._northEast.lat += diffLat;
    scaledSubBounds._northEast.lng += diffLng;
    scaledSubBounds._southWest.lat += diffLat;
    scaledSubBounds._southWest.lng += diffLng;
    
    return scaledSubBounds;
};

L.FGUtils.checkMoveFeatureGroup = function (fg, newCenter, maxBounds) {
    var oldCenter = fg.getBounds().getCenter();
    var moveLat = newCenter.lat - oldCenter.lat;
    var moveLng = newCenter.lng - oldCenter.lng;
    
    var bb = fg.getBounds();
    var bbNE = bb._northEast.clone();
    var bbSW = bb._southWest.clone();
    
    bbNE.lat += moveLat;
    bbNE.lng += moveLng;
    bbSW.lat += moveLat;
    bbSW.lng += moveLng;
    
    if (! maxBounds.contains(bbNE)) {
        return false;
    }
    if (! maxBounds.contains(bbSW)) {
        return false;
    }
    
    return true;
};

L.FGUtils.getFGOptions = function (fg) {
    var nestedOptions = [];
    var subLayers = fg.getLayers();
    
    for (var i=0; i<subLayers.length; i++) {
        if (subLayers[i] instanceof L.FeatureGroup) {
            nestedOptions.push(L.FGUtils.getFGOptions(subLayers[i]));
        }
        else {
            nestedOptions.push(L.extend({}, subLayers[i].options));
        }
    }
    
    return nestedOptions;
};

L.FGUtils.applyFGOptions = function (fg, options) {
    var nestedOptions = [];
    var subLayers = fg.getLayers();
    
    for (var i=0; i<subLayers.length; i++) {
        if (subLayers[i] instanceof L.FeatureGroup) {
            L.FGUtils.applyFGOptions(subLayers[i], options[i]);
        }
        else if (subLayers[i].setStyle) {
            subLayers[i].setStyle(options[i]);
        }
    }
    
    return nestedOptions;
};

L.FGUtils.markFGChildren = function (fg, idx) {
    var id = idx;
    if (typeof(idx) == 'undefined') {
        id =  L.stamp(fg);
    }
    fg.eachLayer(function (layer) {
        layer._topOwner = id;
        if (layer instanceof L.FeatureGroup) {
            L.FGUtils.markFGChildren(layer, id);
        }
    });
    fg._topOwner = id;
};

L.FGUtils.redimensionFeatureGroup = function (fg, bbN) {
    var bbO = fg.getBounds();
    var scale = L.FGUtils.getDeltaScale(bbO, bbN);
    
    if (Math.abs(scale-1) <= L.FGUtils.RedimensionMoveRatio) {
        L.FGUtils.moveFeatureGroup(fg, bbN.getCenter());
    }
    else {
        var fixedCornerIndex;
        var fixedCornerPoint;
        
        var left = bbN.getWest();
        var right = bbN.getEast();
        var top = bbN.getNorth();
        var bottom = bbN.getSouth();
        var width = (right - left);
        var height = (top - bottom);
        
        if ((top == bbO.getNorth()) && ((left+width) == bbO.getEast())) {
            fixedCornerIndex = 0;
            fixedCornerPoint = new L.LatLng(top, left + width);
        }
        else if ((top == bbO.getNorth()) && (left == bbO.getWest())) {
            fixedCornerIndex = 1;
            fixedCornerPoint = new L.LatLng(top, left);
        }
        else if (((top-height) == bbO.getSouth()) && (left == bbO.getWest())) {
            fixedCornerIndex = 2;
            fixedCornerPoint = new L.LatLng(top, left);
            
        }
        else {
            fixedCornerIndex = 3;
            fixedCornerPoint = new L.LatLng(top, left + width);
            
        }
        
        L.FGUtils.resizeFeatureGroup(fg, bbN, fixedCornerPoint, fixedCornerIndex);
    }
};

L.FGUtils.setStyle = function (fg, style) {
    if (fg.hasOwnProperty('_styler')) {
        fg._styler.setStyle(style);
        return;
    }
    
    var b = fg.getBounds();
    var ne = new L.LatLng(b.getNorth(), b.getEast());
    var sw = new L.LatLng(b.getSouth(), b.getWest());
    var styler = new L.Rectangle([ne, sw], {
        'color': 'transparent',
        'fillColor': 'transparent'
    });
    
    fg._styler = styler;
    styler.addTo(fg);
    styler.setStyle(style);
    styler.bringToBack();
    
    var adjustStyler = function (e) {
        var b = fg.getBounds();
        styler.setBounds(b);
    };
    
    fg.on('layeradd', adjustStyler);
    fg.on('layerremove', adjustStyler);
};

L.FGUtils.resizeFeatureGroup_Quicktest = function (map) {
    var nwCorner = map.unproject([98, 98], 4);
    var seCorner = map.unproject([196, 196], 4);
    
    var p1 = map.unproject([196, 98], 4);
    var p2 = map.unproject([294, 98], 4);
    var p3 = map.unproject([196, 196], 4);
    var p4 = p3.clone();
    var p5 = p2.clone();
    
    var s1 = L.rectangle([nwCorner, seCorner], {color: "#ff7800", weight: 1});
    var s2 = L.polygon([p1, p2, p3, p1], {color: 'red'});
    var s3 = L.circle(p4, {radius: 2, color: 'blue'});
    var s4 = L.marker(p5, {});
    
    var p6 = map.unproject([98, 196], 4);
    var p7 = map.unproject([196, 294], 4);
    var p8 = p3.clone();
    var p9 = p3.clone();
    var p10 = p7.clone();
    var p11 = p2.clone();
    var p12 = map.unproject([392, 392], 4);
    
    var s5 = L.polygon([p6, p7, p8, p6], {color: 'green'});
    var s6 = L.polygon([p9, p10, p11, p9], {color: 'orange'});
    var s7 = L.featureGroup([s1, s2, s3, s4]);
    var s8 = L.featureGroup([s5, s6]);
    
    var fg = L.featureGroup([s7, s8])
              .addTo(map);
              
    var originalBounds = fg.getBounds();
    var scale = 2;
    var width = originalBounds._northEast.lng - originalBounds._southWest.lng;
    var height = originalBounds._northEast.lat - originalBounds._southWest.lat;
    
    var scaledBounds = new L.LatLngBounds(
        new L.LatLng(originalBounds._northEast.lat, originalBounds._northEast.lng + (scale-1)*width),
        new L.LatLng(originalBounds._southWest.lat - (scale-1)*height, originalBounds._southWest.lng)
    );
     
    L.FGUtils.resizeFeatureGroup(fg, scaledBounds);
    console.log('check', L.FGUtils.checkMoveFeatureGroup(fg, p12, map.options.maxBounds));
    L.FGUtils.moveFeatureGroup(fg, p12);
};
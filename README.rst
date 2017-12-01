===============
Leaflet.Draw.FeatureGroup
===============

Implements edit move, edit resize, and delete functionality for Feature Groups with Leaflet.Draw using the functionality of Leaflet.FGUtils below. You'll need to first include Leaflet.Draw to use this, of course.

===============
Leaflet.FGUtils
===============

Standalone utility library for Leaflet Feature Groups.

NOTE: although this library is called "L.FGUtils" and the code and documentation always refers to Feature Groups, all of these functions should also be completely fine with L.LayerGroups. The API listed below are all functions in the L.FGUtils namespace, except where otherwise noted.

----------------
L.FGUtils.redimensionFeatureGroup (fg, bbN)
----------------

Force the Feature Group 'fg' to the size of the bounding box 'bbN'. if the ratio of the area of bbN/fg.getBounds() is roughly 1 (according to L.FGUtils.RedimensionMoveRatio), then L.FGUtils.moveFeatureGroup will be called. otherwise, L.FGUtils.resizeFeatureGroup will be called with fixedCornerPoint/fixedCornerIndex being the one determined to be closest to its corresponding corner in bbN.
    
----------------
L.FGUtils.checkMoveFeatureGroup (fg, newCenter, maxBounds)
----------------

Returns true if the Feature Group 'fg' will remain inside 'maxBounds' if it is moved to 'newCenter'. Otherwise, returns false.

----------------
L.FGUtils.moveFeatureGroup (fg, newCenter)
----------------

Move the Feature Group 'fg' from its current position to the 'newCenter' latlng coordinate.

----------------
L.FGUtils.checkResizeFeatureGroup (fg, bbO, bbN, maxBounds)
----------------

Checks two conditions; returns true if both are met, and otherwise false. first, the function checks if the Feature Group 'fg' with bounding box 'bbO' will successfully scale to 'bbN' without going outside of the bounding box 'maxBounds'. the second condition is that the ratio of the area of bbN to bbO must be greater than or equal to L.FGUtils.MinimumResizeRatio (default of 10%)

----------------
L.FGUtils.resizeFeatureGroup (fg, bbN, fixedCornerPoint, fixedCornerIndex)
----------------

Scale the Feature Group 'fg' to match size 'bbN', scaling each of fg's layers by the ratio of area between bbN/fg.getBounds(). 'fixedCornerPoint' specifies the corner of the Feature Group that should remain in place. 'fixedCornerIndex' is the index of this corner, according to nw=0, ne=1, se=2, sw=3.
   
----------------
L.FGUtils.markFGChildren (fg, idx)
----------------

Mark the '_topOwner' property of every child and sub-child of a Feature Group 'fg' with the value 'idx'.

----------------
L.FGUtils.setStyle (fg, style)
----------------

Apply 'style' to the Feature Group 'fg' without affecting its internal layers. specifically, this function will add a transparent box '_styler' as the topmost layer of the Feature Group and set the style on that.

----------------
L.FGUtils.RedimensionMoveRatio
----------------

If the difference in ratio of the old bounding box to the new bounding box is less than this, (defaulting to +/- 1% difference), L.FGUtils.redimensionFeatureGroup will perform a "move" rather than a "resize+move"
    
----------------
L.FGUtils.MinimumResizeRatio
----------------

The minimum ratio necessary for L.FGUtils.checkResizeFeatureGroup to consider that it is worth resizing to, under the assumption that you won't want to bother resizing to very tiny sizes

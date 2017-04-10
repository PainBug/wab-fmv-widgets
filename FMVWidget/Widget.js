define(['dojo/_base/declare', 'jimu/BaseWidget',
    'dijit/_WidgetsInTemplateMixin',
    'dojo/request/xhr',
    'dojox/encoding/base64',
    'dojo/_base/array',
    'dojo/dom',
    'dojo/on',
    'dojo/_base/lang',
    'dojo',
    'esri/symbols/PictureMarkerSymbol',
    'esri/geometry/Point',
    'esri/geometry/Polyline',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/Color', 'esri/graphic', 'esri/layers/GraphicsLayer',
    'esri/renderers/SimpleRenderer',
    'esri/SpatialReference',
    'dijit/form/Select',
    'dijit/dijit',
    'esri/geometry/Extent',
    "dojo/data/ObjectStore",
    "dojo/store/Memory",
    'dojo/text!./Widget.html',
    "dojo/domReady!"],
  function(declare, BaseWidget, _WidgetsInTemplateMixin, xhr, base64, array, dom, on, lang,
            dojo, PictureMarkerSymbol, Point, Polyline, SimpleMarkerSymbol,
            SimpleLineSymbol, Color, Graphic, GraphicsLayer, SimpleRenderer,
            SpatialReference, Select, dijit, Extent, ObjectStore, Memory,
            template) {

    return declare([BaseWidget, _WidgetsInTemplateMixin], {
      templateString: template,
      plane_icon: require.toUrl('widgets/samplewidgets/FMVWidget/images/plane_blue.png'),

       postCreate: function() {
        this.inherited(arguments);
        console.log('postCreate');
        plane = this.plane_icon;
        map = this.map;

        url = 'http://52.23.194.215/';
        user = 'guest';
        pass = 'guest';

        this._createGraphicLayers();
       },

      startup: function() {
        this.inherited(arguments);
        var date;
        var mission;;
        videoPlayer = dom.byId("videoQuery2");
        on(videoPlayer, 'timeupdate', lang.hitch(this, '_UpdateTelemetry'));
        

        this._getData();
        console.log('startup');
      },

      _toByteArray:  function(str){
            var bytes = [];
            for (var i = 0; i < str.length; ++i) {
                bytes.push(str.charCodeAt(i));
            }
            return bytes;
        },
      _initListeners: function(){
            on(this.s, "change", lang.hitch(this, function(evt){
                array.forEach(this.s.options, lang.hitch(this, function(i) {
                    if (i.value === evt) {
                        console.log(i);
                        date = new Date(i.date);
                        mission = i.mission_id;
                        this._setVideo(i.value);
                        this._getFirstPacket(mission);
                    }
                }));
            }));
        },
        _getData: function(){
            data = [];
            console.log(url);
            console.log(user);
            console.log(pass);
            xhr(url + 'Segments', {
                headers: {
                    "Authorization": "Basic " + base64.encode(this._toByteArray(user + ":" + pass))
                },
                handleAs: "json"
            }).then(lang.hitch(this, function (response) {
                console.log(response);
                array.forEach(response, function(r){
                    data.push({id:r._id, label: r.name, value: url + 'videos/' + r.media[0].relativeUrl,
                    date: r.startTime, mission_id: r.missionId});
                });
                console.log(data);
                

                this._initSelect(data);
                this._setFirstVideo();
            }));
        },
        _getFirstPacket: function (m) {
            xhr(url + 'telemetrypackets/?missionId=' + m + '&firstPacket', {
                handleAs: "json"
            }).then(lang.hitch(this, function(r){
                this._zoomTo(r.klvs);
            }));
        },
        _zoomTo: function(geom){
            var extent = new esri.geometry.Extent({
                "xmin":geom[14]-0.1,"ymin":geom[13]-0.1,"xmax":geom[14]+0.1,"ymax":geom[13]+0.1,
                "spatialReference":{"wkid":4326}
            });
            map.setExtent(extent, true);
        },
        _setFirstVideo: function(){
            date = data[0].date;
            mission = data[0].mission_id;
            videoPlayer.src = data[0].value;
            videoPlayer.play();
            this._getFirstPacket(mission);
        },
        _setVideo: function(url){
            videoPlayer.src = url
            videoPlayer.play();
        },
        _initSelect: function(data){
            this.s = new Select({
                name: "select_id",
                options: data
            }).placeAt('targetfmv');

            this._initListeners();
        },
        _UpdateTelemetry: function () {
            var date1 = new Date(date);
            var timestamp = new Date(date1.getTime() + 1000 * videoPlayer.currentTime);

            xhr.get(url + 'telemetrypackets/?missionId=' + mission + '&time_start=' + timestamp, {
                headers: {
                    "X-Requested-With": null
                },
                handleAs: "json"
            }).then(function (pckt) {
                if (pckt != null) {
                    try {
                        if (pckt != null && pckt != null) {
                            //map.graphics.clear()
                            var pta = new Point([pckt.klvs[14], pckt.klvs[13]], new SpatialReference({ wkid: 4326 }));
                            picSymbol = new PictureMarkerSymbol(plane, 40, 40);
                            picSymbol.setAngle(pckt.klvs[5]);
                            polylineJson = {
                                "paths": [[[pckt.klvs[24] + pckt.klvs[27], pckt.klvs[23] + pckt.klvs[26]],
                                    [pckt.klvs[24] + pckt.klvs[29], pckt.klvs[23] + pckt.klvs[28]],
                                    [pckt.klvs[24] + pckt.klvs[31], pckt.klvs[23] + pckt.klvs[30]],
                                    [pckt.klvs[24] + pckt.klvs[33], pckt.klvs[23] + pckt.klvs[32]],
                                    [pckt.klvs[24] + pckt.klvs[27], pckt.klvs[23] + pckt.klvs[26]]
                                ]],
                                "spatialReference": { "wkid": 4326 }
                            };
                            var polylineJson2 = {
                                "paths": [[[pckt.klvs[14], pckt.klvs[13]],
                                    [pckt.klvs[24], pckt.klvs[23]],
                                ]],
                                "spatialReference": { "wkid": 4326 }
                            };

                            var polyline = new Polyline(polylineJson);
                            var polyline2 = new Polyline(polylineJson2);


                            pointGraphicsFMV.clear();
                            polylineGraphicsFMV.clear();
                            polylineGraphicsbboxFMV.clear();

                            // plane graphics
                            var graphicFMV = new Graphic(pta);
                            pointGraphicsFMV.renderer.symbol.setAngle(pckt.klvs[5]);
                            pointGraphicsFMV.add(graphicFMV);

                            var graphic2FMV = new Graphic(polyline2);

                            polylineGraphicsFMV.add(graphic2FMV);

                            var graphic3FMV = new Graphic(polyline);
                            polylineGraphicsbboxFMV.add(graphic3FMV);

                        }
                    }
                    catch (ex) {
                        console.log(ex);
                    }
                }
            })
        },
        _createGraphicLayers: function () {
            console.log('graphic layers');
            //plain
            pointSymbolFMV = new PictureMarkerSymbol(plane, 40, 40);
            pointGraphicsFMV = new GraphicsLayer({
                    id: 'FMV_fov_plane',
                    title: 'FMV Plane'
                });

            pointRendererFMV = new SimpleRenderer(pointSymbolFMV);
            pointGraphicsFMV.setRenderer(pointRendererFMV);
            map.addLayer(pointGraphicsFMV);


            // center - plain line
            polylineSymbolFMV = new SimpleLineSymbol(SimpleLineSymbol.STYLE_LONGDASH, new Color([0, 0, 255]), 1);
            polylineGraphicsFMV = new GraphicsLayer({
                    id: 'FMV_center_line'
                });

            polylineRendererFMV = new SimpleRenderer(polylineSymbolFMV);
            polylineGraphicsFMV.setRenderer(polylineRendererFMV);
            map.addLayer(polylineGraphicsFMV);

            // fov line
            polylineSymbolbboxFMV = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 2);
            polylineGraphicsbboxFMV = new GraphicsLayer({
                    id: 'FMV_FOV',
                    title: 'FMV FOV'
                });


            polylineRendererbboxFMV = new SimpleRenderer(polylineSymbolbboxFMV);
            polylineGraphicsbboxFMV.setRenderer(polylineRendererbboxFMV);
            map.addLayer(polylineGraphicsbboxFMV);
        },

    });
  });
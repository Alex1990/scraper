/**
 * scraper - v0.9
 * The online form of scratch card

 * http://Alex1990.github.io/scraper
 * Alex Chao - http://www.xiaocaoge.com
 * Under the MIT License
 */
(function(win) {

    'use strict';

    var scraper = function(canvas, opts) {

        // 检测是否是触摸屏
        var isTouch = 'ontouchstart' in window || navigator.msMaxTouchPoints;

        // 检测IE Mobile版本
        var isIE11m = window.navigator.pointerEnabled ? true: false;
        var isIE10m = window.navigator.msPointerEnabled && !isIE11m ? true : false;

        var startEvt,
            moveEvt,
            endEvt;
        
        // 根据不同浏览器，以及是否触屏返回相应的事件
        if (isTouch) {
            if (isIE11m) {
                startEvt = 'pointerdown';
                moveEvt = 'pointermove';
                endEvt = 'pointerup';
            } else if (isIE10m) {
                startEvt = 'MSPointerDown';
                moveEvt = 'MSPointerMove';
                endEvt = 'MSPointerUp';
            } else {
                startEvt = 'touchstart';
                moveEvt = 'touchmove';
                endEvt = 'touchend';
            }
        } else {
            startEvt = 'mousedown';
            moveEvt = 'mousemove';
            endEvt = 'mouseup';
        }

        // 绑定事件函数
        var addEvent;
        if (document.addEventListener) {
            addEvent = function(eTarget, type, listener) {
                eTarget.addEventListener(type, listener, false);
            };
        } else if (document.attachEvent) {
            addEvent = function(eTarget, type, listener) {
                eTarget[type+listener] = function(e) {
                    e = window.event;
                    e.target = e.srcElement;
                    e.currentTarget = eTarget;
                    e.preventDefault = function() { e.returnValue = false; };
                    e.stopPropagation = function() { e.cancalBubble = true; };
                    listener.call(eTarget, e);
                };
                eTarget.attachEvent('on'+type, eTarget[type+listener]);
            };
        }

        // 解绑事件函数
        var removeEvent;
        if (document.removeEventListener) {
            removeEvent = function(eTarget, type, listener) {
                eTarget.removeEventListener(type, listener, false);
            };
        } else if (document.detachEvent) {
            removeEvent = function(eTarget, type, listener) {
                eTarget.detachEvent('on'+type, eTarget[type+listener]);
                eTarget[type+listener] = null;
            };
        }

        // 默认配置
        var defaults = {
            bindElement: document, // 事件代理对象
            coverText: ['', 0, 0], // 数组中三个值依次代表覆盖层显示文字、文字横坐标、文字纵坐标
            coverFont: '24px Arial, Microsoft Yahei, sans-serif', // 覆盖层文字格式
            coverColor: '#333', // 覆盖层文字颜色
            coverBgColor: '#eee', // 覆盖层颜色
            pointRadius: 10, // 刮覆盖层时，触点半径
            prizeArea: [0, 0, 100, 40], // 结果(中奖)区域，矩形，参数依次为x, y, width, height
            shape: null, // 覆盖层形状图片，默认无图片，为矩形
            shapeX: 0, // 覆盖层形状图片左上角到canvas左上角水平距离
            shapeY: 0, // 覆盖层形状图片左上角到canvas左上角垂直距离
            shapeW: null, // 覆盖层形状图片宽度
            shapeH: null, // 覆盖层形状图片高度
            onscrape: function() {}, // 开始刮时触发此事件
            onresult: function() {} // 刮到结果(中奖)区域时触发事件
        };

        // 将用户配置项与默认配置项合并
        opts = mergeOpts(defaults, opts);

        // 获取画布的宽度与高度
        opts.width = canvas.width;
        opts.height = canvas.height;

        // 填充画布的覆盖层
        var ctx = canvas.getContext('2d');
        if (!opts.shape) {
            ctx.beginPath();
            ctx.fillStyle = opts.coverBgColor;
            ctx.rect(0, 0, opts.width, opts.height);
            ctx.fill();
            ctx.closePath();
        } else {
            var tmpImg = new Image();
            tmpImg.src = opts.shape;
            ctx.drawImage(tmpImg, opts.shapeX, opts.shapeY, opts.shapeW, opts.shapeH);
        }

        // 绘制文字于覆盖层上
        if (opts.coverFont) {
            ctx.beginPath();
            ctx.fillStyle = opts.coverColor;
            ctx.font = opts.coverFont;
            ctx.fillText(opts.coverText[0], opts.coverText[1] || 0, opts.coverText[2] || 0);
            ctx.closePath();
        }

        // 标记是否被刮过，用来避免opts.onscrape一直触发
        var scraped = false;

        // 绑定鼠标按下或手指触摸时的回调函数
        addEvent(opts.bindElement, startEvt, startScrape);

        // 绑定鼠标松开或手指离开屏幕时的回调函数
        addEvent(opts.bindElement, endEvt, stopScrape);

        // 鼠标按下或手指触摸回调函数
        function startScrape(e) {
            if (!scraped) {
                opts.onscrape.call(opts);
            }
            addEvent(opts.bindElement, moveEvt, scrapeCover);
        }

        // 鼠标松开或手指离开屏幕回调函数，解绑鼠标或手指滑动事件
        function stopScrape() {
            removeEvent(opts.bindElement, moveEvt, scrapeCover);
        }

        var log = document.getElementById('log');

        // 手指或鼠标滑动回调
        function scrapeCover(e) {

            // touchmove事件触发时，阻止触发页面滚动
            e.preventDefault();
            e.stopPropagation();

            var i,
                len,
                scrapeX,
                scrapeY,
                points = [e],
                ctx1= ctx,
                prizeArea = opts.prizeArea,
                pointRadius = opts.pointRadius;

            if (isTouch && !isIE11m && !isIE10m ) {
                points =  e.targetTouches;
            }

            len = points.length;
            for (i = 0; i < len; i++) {
                scrapeX = points[i].clientX + scrollX() - pageX(canvas);
                scrapeY = points[i].clientY + scrollY() - pageY(canvas);


                // 清除手指或鼠标位置处的覆盖层
                ctx1.save();
                ctx1.globalCompositeOperation = 'destination-out';
                ctx1.beginPath();
                ctx1.arc(scrapeX, scrapeY, pointRadius, 0, Math.PI * 2);
                ctx1.fill();

                // 若采用下面两行代码的方式清除圆形画布层，在G18/Android4.0.3自带浏览器中不起作用
                // ctx1.clip();
                // ctx1.clearRect(0, 0, opts.width, opts.height);
                ctx1.restore();

                if (scrapeX >= prizeArea[0] && 
                        scrapeY >= prizeArea[1] &&
                        scrapeX <= (prizeArea[0] + prizeArea[2]) &&
                        scrapeY <= (prizeArea[1] + prizeArea[3])) {

                    // 触发结果回调
                    opts.onresult();

                    // 标记已经被刮开
                    scraped = true;
                }
            }
        }

    };
    
    // 合并两个对象
    function mergeOpts(opts1, opts2) {
        for (var item in opts2) {
            opts1[item] = opts2[item];
        }
        return opts1;
    }

    // 返回元素距离页面左上角的水平距离
    function pageX(el) {
        var x = 0;
        while (el = el.offsetParent) {
            x += el.offsetLeft;
        }
        return x;
    }

    // 返回元素距离页面左上角的垂直距离
    function pageY(el) {
        var y = 0;
        while (el = el.offsetParent) {
            y += el.offsetTop;
        }
        return y;
    }

    // 返回文档滚动过的水平距离
    function scrollX() {
        return window.scrollX || document.documentElement.scrollLeft ||
                document.body.scrollLeft;
    }

    // 返回文档滚动过的垂直距离
    function scrollY() {
        return window.scrollY || document.documentElement.scrollTop ||
                document.body.scrollTop;
    }

    // 将scraper绑定到全局变量
    win.scraper = scraper;
})(window);
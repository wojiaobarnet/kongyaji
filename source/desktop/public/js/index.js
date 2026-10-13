

var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?983eb7cf82fbe9928e6f3b13c6e097ca";
  var s = document.getElementsByTagName("script")[0]; 
  s.parentNode.insertBefore(hm, s);
})();


$(function () {
    banner();
    share();
    inews();
	toolbar();
	$('#scroll').slide({ titCell:'.hd ul', mainCell:'.bd ul', autoPlay:true, autoPage:true, delayTime:500,interTime:3000, effect:'leftLoop',trigger:"click",vis:1});
    $('#inews').slide({ titCell:'.hd ul', mainCell:'.bd ul', autoPlay:true, autoPage:true, delayTime:500,interTime:3000, effect:'leftLoop',trigger:"click",vis:1});
    $('.news-l').slide({ titCell:'.hd ul', mainCell:'.bd ul', autoPlay:true, autoPage:true, delayTime:500,interTime:3000, effect:'leftLoop',trigger:"click",vis:3});
    $(".proCase").slide({mainCell:".bd ul",autoPlay:true,effect:"leftMarquee",vis:3,interTime:20,trigger:"click"});
    $(".returnTop2,.returnTop").click(function() {
		$("body, html").stop().animate({
			"scrollTop": 0
		});
	});
	
	$("#addFavo").click(function() {
		var fm = $("title").html();
		AddFavorite(fm, location.href, '');
	});
	$("#setHome").click(function(){
        SetHome($('title').html(), location.href, '');
	});   
});
//toolbar
function toolbar() {
    $('#toolbar dd').bind({
        'mouseenter': function () {
            if ($(this).children('.slide').length) {
                var _this = $(this).children('.slide');
                _this.stop(true, true).animate({ 'width': 180 }, 200);
            } else if ($(this).children('.pop').length) {
                var _this = $(this).children('.pop');
                _this.show().animate({ 'right': 65 }, 200);
            }
        },
        'mouseleave': function () {
            if ($(this).children('.slide').length) {
                var _this = $(this).children('.slide');
                _this.stop(false, false).animate({ 'width': 0 }, 200);
            } else if ($(this).children('.pop').length) {
                var _this = $(this).children('.pop');
                _this.hide().animate({ 'right': 90 }, 200);
            }
        }
    });
	$("#top").click(function() {
		$("body, html").stop().animate({
				"scrollTop": 0
		});
	});
}
// 加入收藏 兼容360和IE6
function AddFavorite(title, url) {
    try {
        window.external.addFavorite(url, title);
    } catch (e) {
        try {
            window.sidebar.addPanel(title, url, "");
        } catch (e) {
            alert("抱歉，您所使用的浏览器无法完成此操作。\n\n加入收藏失败，请使用Ctrl+D进行添加");
        }
    }
}
// banner焦点图
function banner() {
    if (!$("#banner").length || $("#banner li").length <= 1) {	return false; }
    $("#banner ul li:gt(0)").css({"display":"none"});
    var b = $("#banner"),
        me = $("#banner ul"),
        tip = $("#banner .tip"),
        t, interval = 10000,
        speed = 1000,
        speed2 = 700,
        n = 0,
        N = me.children("li").length;
    wid = b.children("li").width();
    step = 200,time = 3000;
    if ($("#banner .tip").length) {
        var htmlTip = "";
        for (var i = 0; i < N; i++) {
            if (i == 0) {
                htmlTip += "<span class='cur icon'>"+(i+1)+"</span>";
            } else {
                htmlTip += "<span class='icon'>"+(i+1)+"</span>";
            }
        }
        tip.html(htmlTip);
    }
    var func = function() {
        if (n >= N - 1) {
            n = 0;
        }else if(n < -1){
            n = N-1;
        }
        else {
            n++;
        }
        me.children("li").eq(n).css({
            "z-index": 2
        }).stop().fadeIn(speed).siblings("li").css({
            "z-index": 1
        }).stop().fadeOut(speed2);
        if ($("#banner .tip").length) {
            tip.children("span").eq(n).addClass("cur").siblings("span").removeClass("cur");
        }
    }
    $("#banner").hover(function(){
        $("#btn_prev,#btn_next").fadeIn()
    },function(){
        $("#btn_prev,#btn_next").fadeOut()
    })
    $dragBln = false;
    $("#btn_prev").click(function(){
        clearInterval(t);
        n -= 2;
        func();
        t = setInterval(func, time)
    });
    $("#btn_next").click(function(){
        clearInterval(t);
        func();
        t = setInterval(func, time)
    });

    tip.children("span").click(function() {
        clearInterval(t);
        n = $(this).index() - 1;
        func();
        t = setInterval(func, interval);
    })
    $("#banner ul.list li").mouseenter(function() {
        clearInterval(t);
    }).mouseleave(function() {
        t = setInterval(func, time);
    });
    t = setInterval(func, interval);
}
//inews
function inews(){ 
	var $a=$("#inews").find(".tog").find("div");
	var i=2;
	var page=1;
	var $v_show=$("#inews .inewsCon .list");
	var $v_content=$("#inews .inewsCon");
	var v_width=$v_content.width();
	var len=$v_content.find(".item").length;
	var page_count=Math.ceil(len/i);
	$v_show.width(page_count*v_width);
	if(len < 3){
		$a.hide();
	}
	$a.click(function(){
		var $sty=$(this).attr("class");
		if(!$v_show.is(":animated")){
		   if($sty=="prev"){
			  if(page==1){
					 $v_show.animate({left:-v_width*(page_count-1)+"px"},500);
					 page=page_count;  
			  }else{
					 $v_show.animate({left:"+="+v_width+"px"},500);                                    
					 page--;
			  }  
		   }
		   if($sty=="next"){
			  if(page==page_count){
					$v_show.animate({left:0},500);
					page=1;
			  }else{
					$v_show.animate({left:"-="+v_width+"px"},500);
					page++;
			  }   
		   }
		}
	});
}
function layout(u){
	var $obj = $('<div class="dialog-layout"></div>');
	if(u == 0){
		$('.dialog-layout').remove();
	}else{
		if(!$('.dialog-layout').length){
			$obj.appendTo('body').show();
		}
	}
}
function share(){
	window._bd_share_config = {
    "common": {
        "bdSnsKey": {},
        "bdText": "",
        "bdMini": "2",
        "bdMiniList": false,
        "bdPic": "",
        "bdStyle": "0",
        "bdSize": "16"
    },
    "share": {},
    "slide": { // 跟图标式的代码相比，这里是添加了浮窗式 slide 属性配置
        "type": "slide",
        "bdImg": "6",
        "bdPos": "left",
        "bdTop": "100"
    }
};
	window._bd_share_config = {
		share : [{
			"bdSize" : 16
		}],
	}
	with(document)0[(getElementsByTagName('head')[0]||body).appendChild(createElement('script')).src='http://bdimg.share.baidu.com/static/api/js/share.js?cdnversion='+~(-new Date()/36e5)];
}

function AddFavorite(title, url) {
    try {
        window.external.addFavorite(url, title);
    } catch (e) {
        try {
            window.sidebar.addPanel(title, url, "");
        } catch (e) {
            alert("抱歉，您所使用的浏览器无法完成此操作。\n\n加入收藏失败，请使用Ctrl+D进行添加");
        }
    }
}
function SetHome(obj,url){
	try{
		obj.style.behavior='url(#default#homepage)';
		obj.setHomePage(url);
   }catch(e){
	   if(window.netscape){
		  try{
			  netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
		 }catch(e){
			  alert("抱歉，此操作被浏览器拒绝！\n\n请在浏览器地址栏输入“about:config”并回车然后将[signed.applets.codebase_principal_support]设置为'true'");
		  }
	   }else{
		alert("抱歉，您所使用的浏览器无法完成此操作。\n\n您需要手动将【"+url+"】设置为首页。");
	   }
  }
}
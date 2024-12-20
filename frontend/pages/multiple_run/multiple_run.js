// pages/multiple_run.js
const utils = require('../../utils/util.js')
const app = require('../../app.js');

Page({
    data: {
        meters: 0, // 里程，单位米
        seconds: 0, // 时间，单位秒
        latitude: 39.9050, // 纬度
        longitude: 116.4070, // 经度
        running: false, // 是否开始
        interval: 1000, // 定位更新间隔，单位毫秒
        points: [], // 存储本人的轨迹点
        markers: [], // 其他人的位置标记
        showMap: false, // 控制地图是否显示
        polyline: [], // 路线
        userName: '', // 用户名
        paceFormatted: '', // 格式化配速输出
        startTime: '', // 开始跑步时间

        users: [{
                profilePic: '../../images/my-icon.png',
                username: 'NULL'
            },
            {
                profilePic: '../../images/my-icon.png',
                username: 'NULL'
            },
            {
                profilePic: '../../images/my-icon.png',
                username: 'NULL'
            },
            {
                profilePic: '../../images/my-icon.png',
                username: 'NULL'
            },
            {
                profilePic: '../../images/my-icon.png',
                username: 'NULL'
            },
            {
                profilePic: '../../images/my-icon.png',
                username: 'NULL'
            },
            {
                profilePic: '../../images/my-icon.png',
                username: 'NULL'
            },
            {
                profilePic: '../../images/my-icon.png',
                username: 'NULL'
            },
            {
                profilePic: '../../images/my-icon.png',
                username: 'NULL'
            },
        ],

        verifiedRoomID: '',
        lastUpdateTime: null, // 上次更新时间
    },

    formatPace: function () {
        const pace = (this.data.meters === 0) ? 0 : Math.round(this.data.seconds * 1000 / this.data.meters);
        const minutes = Math.floor(pace / 60);
        const seconds = (pace % 60).toString().padStart(2, '0');
        this.setData({
            paceFormatted: `${minutes}'${seconds}"`
        });
    },

    onLoad() {
        app.tokenCheck();
        //格式化日期 xxxx/xx/xx
        const date = new Date();
        this.setData({
            formattedDate: utils.formatDate(date),
        });

        this.mapCtx = wx.createMapContext('map');
        wx.getLocation({
            type: 'gcj02',
            success: (res) => {
                console.log('获取位置成功')
                this.setData({
                    latitude: res.latitude,
                    longitude: res.longitude,
                    showMap: true,
                });
            },
            fail: (error) => {
                console.error('获取位置失败', error);
                wx.showToast({
                    title: '无法获取位置信息',
                    icon: 'none',
                });
            },
        });

        const username = wx.getStorageSync('username');
        if (username) {
            this.setData({
                username: username,
            });
        }

        const verifiedRoomID = wx.getStorageSync('verifiedRoomID');
        if (verifiedRoomID) {
            this.setData({
                verifiedRoomID: verifiedRoomID,
            });
        }

        const that = this;
        const runID = that.data.verifiedRoomID;

        if (!runID) {
            wx.showToast({
                title: '房间号不可用',
                icon: 'error'
            });
            return;
        }

        wx.request({
            url: global.utils.getAPI(global.utils.serverURL, `/api/runRoom/${runID}`),
            method: 'GET',
            success(res) {
                if (res.data.success && res.data.code === 'ROOM_FOUND') {
                    const users = res.data.data.runners.map(user => ({
                        username: user.username,
                        profilePic: user.profile_pic,
                        latitude: user.latitude,
                        longitude: user.longitude,
                    }));

                    console.log('Users:', users);

                    that.setData({
                        users: users
                    });
                } else {
                    wx.showToast({
                        title: '加载用户失败',
                        icon: 'none'
                    });
                }
            },
            fail(err) {
                wx.showToast({
                    title: '获取数据失败',
                    icon: 'none'
                });
            }
        });

        this.formatPace();
        this.otherRunnersInterval = setInterval(this.updateOtherRunners.bind(this), 5000);
    },

    updateOtherRunners() {
        const runID = this.data.verifiedRoomID;
        if (!runID) return;

        wx.request({
            url: global.utils.getAPI(global.utils.serverURL, `/api/runRoom/${runID}`),
            method: 'GET',
            success: (res) => {
                if (res.data.success && res.data.code === 'ROOM_FOUND') {
                    const currentUsername = wx.getStorageSync('username');
                    const otherRunners = res.data.data.runners.filter(
                        runner => runner.username !== currentUsername && runner.in_room === true
                    );

                    // 更新其他跑步者的标记
                    const markers = otherRunners.map((runner, index) => ({
                        id: index,
                        latitude: runner.latitude,
                        longitude: runner.longitude,
                        width: 30,
                        height: 30,
                        iconPath: '../../images/my-icon.png',
                        callout: {
                            content: runner.nickname || runner.username,
                            color: '#000000',
                            fontSize: 14,
                            borderRadius: 5,
                            padding: 5,
                            display: 'ALWAYS',
                            textAlign: 'center',
                            bgColor: '#ffffff'
                        }
                    }));

                    // 更新用户列表数据
                    const updatedUsers = res.data.data.runners.map(runner => ({
                        profilePic: runner.profile_pic || '../../images/my-icon.png',
                        username: runner.username,
                        nickname: runner.nickname,
                        meters: runner.meters,
                        seconds: runner.seconds,
                        running: runner.running,
                        marathonPlace: runner.marathon_place
                    }));

                    this.setData({
                        markers,
                        users: updatedUsers
                    });

                    otherRunners.forEach(runner => {
                        if (runner.running) {
                            console.log(`${runner.nickname || runner.username}: ${runner.meters}米`);
                        }
                    });
                }
            },
            fail: (error) => {
                console.error('获取房间数据失败:', error);
            }
        });
    },

    startRun: function (e) {
        this.setData({
            running: !this.data.running
        })
        if (this.data.running == true) {
            console.log("开始跑步")
            this.interval = setInterval(this.record.bind(this), this.data.interval);
            if (this.data.startTime === '') {
                this.setData({
                    startTime: new Date().toISOString()
                });
            }
        } else {
            console.log("暂停/结束跑步")
            clearInterval(this.interval);
        }
    },

    record() {
        if (!this.data.running) {
            return
        }
        const runID = this.data.verifiedRoomID;
        if (!runID) return;
        
        this.setData({
            seconds: this.data.seconds + this.data.interval / 1000
        })
        
        wx.getLocation({
            type: 'gcj02',
        }).then(res => {
            let newPoint = {
                latitude: res.latitude,
                longitude: res.longitude,
                id: this.data.points.length + 1
            }
            
            let points = Array.isArray(this.data.points) ? this.data.points : [];
            let pace = 0;
            
            if (points.length > 0) {
                let lastPoint = points.slice(-1)[0]
                pace = utils.getDistance(lastPoint.latitude, lastPoint.longitude, newPoint.latitude, newPoint.longitude);
                pace = parseFloat(pace.toFixed(1))
                if (pace > 5) {
                    points.push(newPoint);
                } else {
                    pace = 0;
                }
            } else {
                points.push(newPoint);
            }
            
            this.setData({
                latitude: res.latitude,
                longitude: res.longitude,
                points,
                polyline: [{
                    points: points.map(point => ({
                        latitude: point.latitude,
                        longitude: point.longitude
                    })),
                    color: "#009688",
                    width: 5,
                    dottedLine: false,
                    arrowLine: false
                }],
                meters: parseFloat((this.data.meters + pace).toFixed(1))
            })
            
            this.formatPace();
            
            const updateData = {
                username: wx.getStorageSync('username'),
                runData: {
                    meters: parseFloat((this.data.meters).toFixed(1)),
                    seconds: this.data.seconds,
                    latitude: res.latitude,
                    longitude: res.longitude,
                    running: this.data.running,
                    markers: points,
                    start: this.data.startTime,
                }
            };

            wx.request({
                url: global.utils.getAPI(global.utils.serverURL, `/api/users/run/data`),
                method: 'PUT',
                data: updateData,
                success: (res) => {
                    if (res.data.message) {
                        console.log('更新位置成功');
                    }else{
                        console.log('更新位置失败');
                    }
                }
            });
        })
    },

    endRun: function (e) {
        if (this.data.points.length < 2) {
            console.log("你没有开始跑步！");
            wx.showToast({
                title: '你没有开始跑步！',
                icon: 'error'
            })
            return;
        }

        this.setData({
            running: false
        });
        clearInterval(this.interval);

        const runData = {
            username: wx.getStorageSync('username'),
            runRecord: {
                meters: this.data.meters,
                seconds: this.data.seconds,
                markers: this.data.points.map(point => ({
                    latitude: point.latitude,
                    longitude: point.longitude,
                    id: point.id
                })),
                start: this.data.startTime,
                end: new Date().toISOString()
            }
        };

        const app = getApp();
        app.globalData.currentRunData = runData;

        wx.request({
            url: 'http://124.221.96.133:8000/api/users/run/record',
            method: 'POST',
            data: runData,
            success: (res) => {
                console.log('跑步数据上传成功:', res);
                wx.navigateTo({
                    url: '../singlerecord/singlerecord',
                });
            },
            fail: (error) => {
                console.error('跑步数据上传失败:', error);
                wx.showModal({
                    title: '上传失败',
                    content: '是否重试上传数据？',
                    success: (res) => {
                        if (res.confirm) {
                            this.endRun(e);
                        } else {
                            wx.navigateTo({
                                url: '../singlerecord/singlerecord'
                            });
                        }
                    }
                });
            }
        });
    },

    onUnload() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        if (this.otherRunnersInterval) {
            clearInterval(this.otherRunnersInterval);
        }
    }

});
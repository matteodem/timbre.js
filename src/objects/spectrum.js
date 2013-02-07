(function(T) {
    "use strict";
    
    var fn = T.fn;
    var timevalue = T.timevalue;
    var FFT = T.modules.FFT;
    
    function SpectrumNode(_args) {
        T.Object.call(this, _args);
        fn.listener(this);
        fn.fixAR(this);

        var _ = this._;
        _.status  = 0;
        _.samples = 0;
        _.samplesIncr = 0;
        _.writeIndex  = 0;
        
        _.plotFlush = true;
        _.plotRange = [0, 32];
        _.plotBarStyle = true;
        
        this.once("init", oninit);
    }
    fn.extend(SpectrumNode);
    
    var oninit = function() {
        var _ = this._;
        if (!_.fft) {
            this.size = 512;
        }
        if (!_.interval) {
            this.interval = 500;
        }
    };
    
    var $ = SpectrumNode.prototype;
    
    Object.defineProperties($, {
        size: {
            set: function(value) {
                var _ = this._;
                if (!_.fft) {
                    if (typeof value === "number") {
                        var n = (value < 256) ? 256 : (value > 2048) ? 2048 : value;
                        _.fft    = new FFT(n);
                        _.buffer = new fn.SignalArray(_.fft.length);
                        _.freqs  = new fn.SignalArray(_.fft.length>>1);
                        if (_.reservedwindow) {
                            _.fft.setWindow(_.reservedwindow);
                            _.reservedwindow = null;
                        }
                        if (_.reservedinterval) {
                            this.interval = _.reservedinterval;
                            _.reservedinterval = null;
                        }
                    }
                }
            },
            get: function() {
                return this._.buffer.length;
            }
        },
        window: {
            set: function(value) {
                this._.fft.setWindow(value);
            },
            get: function() {
                return this._.fft.windowName;
            }
        },
        interval: {
            set: function(value) {
                var _ = this._;
                if (typeof value === "string") {
                    value = timevalue(value);
                }
                if (typeof value === "number" && value > 0) {
                    if (!_.buffer) {
                        _.reservedinterval = value;
                    } else {
                        _.interval = value;
                        _.samplesIncr = (value * 0.001 * T.samplerate);
                        if (_.samplesIncr < _.buffer.length) {
                            _.samplesIncr = _.buffer.length;
                            _.interval = _.samplesIncr * 1000 / T.samplerate;
                        }
                    }
                }
            },
            get: function() {
                return this._.interval;
            }
        },
        spectrum: {
            get: function() {
                return this._.fft.getFrequencyData(this._.freqs);
            }
        },
        real: {
            get: function() {
                return this._.fft.real;
            }
        },
        imag: {
            get: function() {
                return this._.fft.imag;
            }
        }
    });
    
    $.bang = function() {
        this._.samples    = 0;
        this._.writeIndex = 0;
        this._.emit("bang");
        return this;
    };
    
    $.process = function(tickID) {
        var _ = this._;
        var cell = this.cell;

        if (this.tickID !== tickID) {
            this.tickID = tickID;

            fn.inputSignalAR(this);
            
            var i, imax = cell.length;
            var status  = _.status;
            var samples = _.samples;
            var samplesIncr = _.samplesIncr;
            var writeIndex  = _.writeIndex;
            var buffer = _.buffer;
            var bufferLength = buffer.length;
            var mul = _.mul, add = _.add;
            var emit;
            
            for (i = 0; i < imax; ++i) {
                if (samples <= 0) {
                    if (status === 0) {
                        status = 1;
                        writeIndex  = 0;
                        samples += samplesIncr;
                    }
                }
                if (status === 1) {
                    buffer[writeIndex++] = cell[i];
                    if (bufferLength <= writeIndex) {
                        _.fft.forward(buffer);
                        emit = _.plotFlush = true;
                        status = 0;
                    }
                }
                cell[i] = cell[i] * mul + add;
                --samples;
            }
            
            _.samples = samples;
            _.status  = status;
            _.writeIndex = writeIndex;
            
            if (emit) {
                this._.emit("data");
            }
        }
        return cell;
    };
    
    var super_plot = T.Object.prototype.plot;
    
    $.plot = function(opts) {
        if (this._.plotFlush) {
            this._.plotData  = this.spectrum;
            this._.plotFlush = null;
        }
        return super_plot.call(this, opts);
    };
    
    fn.register("spectrum", SpectrumNode);

})(timbre);

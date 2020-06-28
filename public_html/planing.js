function duration(hour, minute) {
        return hour*60+minute;
}
    
function pad2(value) {
    return value.toString().length === 2? value.toString(): "0"+value.toString();
}

function durationToString(duration) {
    return pad2(Math.floor(duration/60)) + ":" + pad2(duration%60);
}

function parseHora(text) {
    let result=/(\d{2}):(\d{2})/.exec(text);
    return result[1]*60+result[2]*1;
}

class DataSet {
    
    constructor(data) {
//        "formato": ["dia", "sala", "pelicula"],
//        "formato": ["dia", "pelicula", "sala"],
//        "formato": ["pelicula", "dia", "sala"],
        this.content=data;
    }
    
    getPelicula(nombre) {
        for(let pelicula of this.content.peliculas) {
            if(pelicula.nombre === nombre || (pelicula.alias && pelicula.alias === nombre)) {
                return pelicula;
            }
        }
        return null;
    }
    
    iterate(fn) {
        let value={
            
        };
        for(let key1 in this.content.programacion) {
            if(this.content.formato[0] === "pelicula") {
                value.nombrePelicula=key1;
            }
            if(this.content.formato[0] === "dia") {
                value.dia=key1;
            }
            for(let key2 in this.content.programacion[key1]) {
                if(this.content.formato[1] === "pelicula") {
                    value.nombrePelicula=key2;
                }
                if(this.content.formato[1] === "dia") {
                    value.dia=key2;
                }
                if(this.content.formato[1] === "sala") {
                    value.sala=key2;
                }
                for(let key3 in this.content.programacion[key1][key2]) {
                    if(this.content.formato[2] === "pelicula") {
                        value.nombrePelicula=key3;
                    }
                    if(this.content.formato[2] === "sala") {
                        value.sala=key3;
                    }
                    fn.apply(null, [value, this.content.programacion[key1][key2][key3]]);
                }
            }
        }
    }
    
    getLimits(date) {
        let limits={
            min:10000,
            max:-1
        };
        
        this.iterate((row, horarios) => {
            if(row.dia === date) {
                for(let horario of horarios) {
                    let hora=parseHora(horario);
                    if(limits.min > hora) {
                        limits.min = hora;
                    }
                    if(limits.max < (hora+this.getPelicula(row.nombrePelicula).duracion)) {
                        limits.max = hora+this.getPelicula(row.nombrePelicula).duracion;
                    }
                }
            }
        });
        limits.min=limits.min - limits.min % 30;
        limits.max=limits.max + (60-limits.max % 30);
        return limits;
    }
    
    getProgramacionPorDiaYSala(date) {
        let programacionPorDiaYSala={};
        this.iterate((row, horarios) => {
            if(row.dia === date) {
                if(!(programacionPorDiaYSala[row.sala])){
                    programacionPorDiaYSala[row.sala]={};
                }
                programacionPorDiaYSala[row.sala][row.nombrePelicula]=horarios;
            }
        });
        return programacionPorDiaYSala;
    }
    
}

jQuery(function($) {
    let dataSet;
    let data;
    $("select").on("change", function() {
        let url=$(this).val();
        $.ajax({
            url: url,
            method: "GET",
            type: "json"
        }).then(function(d){
            data=d;
            dataSet=new DataSet(d);
            $("h1").html(d.descripcion);
            let minDate=new Date(2100, 11, 31);
            let maxDate=new Date(1900, 0, 1);
            for(let fecha in d.programacion) {
                var parts =fecha.split('-');
                var mydate = new Date(parts[0], parts[1] - 1, parts[2]); 
                if(mydate.getTime() < minDate.getTime()) {
                    minDate=mydate;
                }
                if(mydate.getTime() > maxDate.getTime()) {
                    maxDate=mydate;
                }
            }
            $("input[type=date]").attr("min", minDate.getFullYear()+"-"+pad2(minDate.getMonth()+1)+"-"+pad2(minDate.getDate()));
            $("input[type=date]").attr("max", maxDate.getFullYear()+"-"+pad2(maxDate.getMonth()+1)+"-"+pad2(maxDate.getDate()));
            $("input[type=date]").attr("disabled", false)
        });
    });
        
    var canvas = document.getElementById('canvas');
    
    $("input[type=date]").on("change", function(){
        paint(canvas, $("input[type=date]").val());
    });
    $("input[type=date]").attr("disabled", true);
    if(canvas.getContext) {
        function paint(canvas, date) {
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, $(canvas).width(), $(canvas).height());
        
            let programacionPorDiaYSala=dataSet.getProgramacionPorDiaYSala(date);

            let limits=dataSet.getLimits(date);

            let maxWidth=0;
            for (let label in programacionPorDiaYSala) {
                if(ctx.measureText(label).width > maxWidth) {
                    maxWidth=ctx.measureText(label).width;
                }
            }
            let labelWidth=maxWidth+10*2;

            let widthScale=$(canvas).width()/(limits.max-limits.min);
            let fontHeight=10;
            let offsetY=fontHeight+5*2;

            function getScaledX(sourceX, scale, labelWidth) {
                return (sourceX-limits.min)*scale+labelWidth;
            }

            function drawTimeLines(ctx) {
                ctx.save();
                for(let i=limits.min; i <= limits.max; i+=30) {
                    if(i % 60 === 0) {
                        ctx.fillStyle = "black";
                        ctx.fillText(durationToString(i), getScaledX(i, widthScale, labelWidth), fontHeight);
                        ctx.strokeStyle = "black";
                    }else{
                        ctx.strokeStyle = "gray";
                    }
                    ctx.beginPath();
                    ctx.lineWidth = 1;
                    ctx.setLineDash([2, 4]);
                    ctx.moveTo(getScaledX(i, widthScale, labelWidth), 0);
                    ctx.lineTo(getScaledX(i, widthScale, labelWidth), $(canvas).height());
                    ctx.closePath();
                    ctx.stroke();
                }
                ctx.restore();
            }

            let colors=[{
                fill: "rgba(146, 196, 102, 0.8)",
                border: "rgb(72, 99, 57)"
            },{
                fill: "rgba(140, 172, 209, 0.8)",
                border: "rgb(40, 63, 76)"
            },{
                fill: "rgba(242, 98, 70, 0.8)",
                border: "rgb(104, 36, 19)"
            }];

            drawTimeLines(ctx);

            let y=0;
            for (let sala in programacionPorDiaYSala) {
                for(let nombrePelicula in programacionPorDiaYSala[sala]) {
                    for(let horario of programacionPorDiaYSala[sala][nombrePelicula]) {
                        ctx.fillStyle=colors[y%colors.length].fill;
                        ctx.strokeStyle=colors[y%colors.length].border;
                        let pelicula=dataSet.getPelicula(nombrePelicula);
                        ctx.fillRect(getScaledX(parseHora(horario), widthScale, labelWidth), y*60+offsetY, pelicula.duracion*widthScale, 60);
                        ctx.strokeRect(getScaledX(parseHora(horario), widthScale, labelWidth), y*60+offsetY, pelicula.duracion*widthScale, 60);

                        ctx.fillStyle="black";
                        let metrics=ctx.measureText(pelicula.nombre);
                        ctx.fillText(pelicula.nombre, getScaledX(parseHora(horario), widthScale, labelWidth)+(pelicula.duracion*widthScale-metrics.width)/2, y*60+offsetY+30-2);
                        let intervalo=horario +"-"+durationToString(parseHora(horario)+pelicula.duracion);
                        metrics=ctx.measureText(intervalo);
                        ctx.fillText(intervalo, getScaledX(parseHora(horario), widthScale, labelWidth)+(pelicula.duracion*widthScale-metrics.width)/2, y*60+offsetY+60/2+fontHeight+2);
                    }
                }
                y++;
            }

            y=0;
            ctx.fillStyle="black";
            for (let sala in programacionPorDiaYSala) {
                let metrics=ctx.measureText(sala);
                ctx.fillText(sala, (labelWidth-metrics.width)/2, y*60+30+fontHeight/2+offsetY);
                y++;
            }
            
        }
    }
    
});


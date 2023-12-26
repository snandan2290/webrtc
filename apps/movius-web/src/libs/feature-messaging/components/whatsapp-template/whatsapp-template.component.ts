import { ChangeDetectionStrategy, Component, OnInit, Output, Input,  OnChanges, SimpleChanges , EventEmitter } from '@angular/core';

@Component({
    selector: 'movius-web-whatsapp-template',
    templateUrl: './whatsapp-template.component.html',
    styleUrls: ['./whatsapp-template.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppTemplateComponent implements OnInit, OnChanges { 

    @Input() visible;
    @Output() onSelectTemplate = new EventEmitter();
    showTemplate:boolean = false;
    templates: any[] = [];
    isMobileDevice:boolean = false;

    ngOnInit(): void {
        this.isMobileDevice = ((sessionStorage.getItem('Contex_res')?.toLowerCase() === "ios") || (sessionStorage.getItem('Contex_res')?.toLowerCase() === "android"))
            ? true : false;
        if(sessionStorage.getItem('__enable_whatsapp_message__') === "true"){
            if(JSON.parse(sessionStorage.getItem('__enable_whatsapp_templates__')).template.length == undefined) {
                this.templates.push(JSON.parse(sessionStorage.getItem('__enable_whatsapp_templates__')).template)
            } else {
                this.templates =  JSON.parse(sessionStorage.getItem('__enable_whatsapp_templates__')).template
            }
        }
        
    }

    ngOnChanges(changes: SimpleChanges){
        if(changes.visible && changes.visible.currentValue != undefined){
            this.showTemplate = changes.visible.currentValue;
        }
    }

    onSelect(template){
        this.onSelectTemplate.emit(template);
    }

}
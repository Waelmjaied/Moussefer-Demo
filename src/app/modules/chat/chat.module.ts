import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatRoutingModule } from './chat-routing.module';
import { ChatRoomComponent } from './chat-room/chat-room.component';

@NgModule({
  declarations: [],
  imports: [CommonModule, FormsModule, ChatRoutingModule, ChatRoomComponent],
})
export class ChatModule {}

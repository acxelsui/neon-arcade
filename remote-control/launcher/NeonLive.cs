using System;
using System.Collections.Generic;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

// An outbound, authenticated device channel. No listener or inbound PC port.
public sealed class NeonLiveConnection : IDisposable {
 public const string Endpoint="wss://neon-owner-remote.jr7990146.workers.dev/device/live";
 readonly ClientWebSocket socket=new ClientWebSocket();
 readonly CancellationTokenSource lifetime=new CancellationTokenSource();
 readonly JavaScriptSerializer json=new JavaScriptSerializer {MaxJsonLength=1000000};Task readerTask;
 readonly Action<Dictionary<string,object>> receive;readonly Action failed;
 bool disposed=false;
 public bool Ready {get{return !disposed&&socket.State==WebSocketState.Open;}}
 public NeonLiveConnection(Action<Dictionary<string,object>> onReceive,Action onFailed){receive=onReceive;failed=onFailed;socket.Options.KeepAliveInterval=TimeSpan.FromSeconds(10);}
 public async Task Open(string credential){
  socket.Options.SetRequestHeader("Authorization","Device "+credential);
  using(var timeout=CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token)){timeout.CancelAfter(4000);await socket.ConnectAsync(new Uri(Endpoint),timeout.Token);}
  readerTask=Task.Run(async()=>await Read());
 }
 async Task Read(){
  var replies=new JavaScriptSerializer {MaxJsonLength=64000};
  try{byte[] bytes=new byte[8192];while(Ready){using(var output=new MemoryStream()){
   WebSocketReceiveResult packet;do{packet=await socket.ReceiveAsync(new ArraySegment<byte>(bytes),lifetime.Token);if(packet.MessageType==WebSocketMessageType.Close)throw new IOException("Live connection ended.");if(packet.MessageType!=WebSocketMessageType.Text||output.Length+packet.Count>64000)throw new IOException("Invalid live reply.");output.Write(bytes,0,packet.Count);}while(!packet.EndOfMessage);
   var value=replies.DeserializeObject(Encoding.UTF8.GetString(output.ToArray())) as Dictionary<string,object>;if(value==null||value.ContainsKey("error"))throw new IOException("Live connection paused.");receive(value);
  }}}catch{if(!disposed)failed();}
 }
 public async Task Send(Dictionary<string,object> body){
  if(!Ready)throw new IOException("Live connection is unavailable.");byte[] bytes=Encoding.UTF8.GetBytes(json.Serialize(body));if(bytes.Length>800000)throw new IOException("Live video message is too large.");
  using(var timeout=CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token)){timeout.CancelAfter(4000);await socket.SendAsync(new ArraySegment<byte>(bytes),WebSocketMessageType.Text,true,timeout.Token);}
 }
 public void Dispose(){if(disposed)return;disposed=true;lifetime.Cancel();socket.Abort();socket.Dispose();lifetime.Dispose();}
}

<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/_core/bootstrap.php';

function down_details_tables(PDO $pdo):void {
    $pdo->exec('CREATE TABLE IF NOT EXISTS down_interval_notes (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,trip_id BIGINT UNSIGNED NOT NULL,interval_key VARCHAR(191) NOT NULL,notes TEXT NOT NULL,created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),INDEX idx_down_notes (trip_id,interval_key,id),CONSTRAINT fk_down_notes_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS down_interval_images (trip_id BIGINT UNSIGNED NOT NULL,interval_key VARCHAR(191) NOT NULL,mime_type VARCHAR(80) NOT NULL,image MEDIUMBLOB NOT NULL,created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),PRIMARY KEY (trip_id,interval_key),CONSTRAINT fk_down_images_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE)');
}
function down_details_interval(array $events,string $key):array {
    $started=null;$ended=false;
    foreach($events as $event){if(($event['value']['intervalKey']??'')!==$key)continue;if($event['event']==='interval.started'&&strtolower((string)($event['value']['type']??''))==='down')$started=$event;if($event['event']==='interval.ended')$ended=true;}
    if(!$started)api_error('Down interval was not found.',404,'down_interval_not_found');
    return ['active'=>!$ended];
}
$method=require_method('GET','POST');$tripId=require_positive_int($method==='GET'?$_GET:$_POST,'tripId');$key=trim((string)(($method==='GET'?$_GET:$_POST)['intervalKey']??''));
if($key===''||strlen($key)>191)api_error('Invalid Down interval.',422,'invalid_argument');
$pdo=db();require_trip_owner($pdo,$tripId);down_details_tables($pdo);$interval=down_details_interval(fetch_trip_events($pdo,$tripId,'log'),$key);
if($method==='GET'&&($_GET['image']??'')==='1'){$q=$pdo->prepare('SELECT mime_type,image FROM down_interval_images WHERE trip_id=? AND interval_key=?');$q->execute([$tripId,$key]);$row=$q->fetch();if(!$row)api_error('Image not found.',404,'image_not_found');header('Content-Type: '.$row['mime_type']);header('Cache-Control: private, no-store');echo $row['image'];exit;}
if($method==='GET'){$q=$pdo->prepare('SELECT notes FROM down_interval_notes WHERE trip_id=? AND interval_key=? ORDER BY id DESC LIMIT 1');$q->execute([$tripId,$key]);$notes=$q->fetchColumn();$q=$pdo->prepare('SELECT 1 FROM down_interval_images WHERE trip_id=? AND interval_key=?');$q->execute([$tripId,$key]);$has=(bool)$q->fetchColumn();json_response(['tripId'=>$tripId,'intervalKey'=>$key,'notes'=>$notes===false?'':$notes,'hasImage'=>$has,'active'=>$interval['active'],'imageUrl'=>$has?'/api/down-details/?tripId='.$tripId.'&intervalKey='.rawurlencode($key).'&image=1':null]);}
require_csrf();$notes=(string)($_POST['notes']??'');if(strlen($notes)>10000)api_error('Notes must be 10,000 characters or fewer.',422,'invalid_argument');
$result=audited_write(static function(PDO $pdo)use($tripId,$key,$notes,$interval):array{
    $q=$pdo->prepare('SELECT notes FROM down_interval_notes WHERE trip_id=? AND interval_key=? ORDER BY id DESC LIMIT 1');$q->execute([$tripId,$key]);$previous=$q->fetchColumn();if($previous===false||$previous!==$notes){$pdo->prepare('INSERT INTO down_interval_notes (trip_id,interval_key,notes) VALUES (?,?,?)')->execute([$tripId,$key,$notes]);$noteId=(int)$pdo->lastInsertId();$pdo->prepare("INSERT INTO log (user_id,action,table_name,record_id,before_data,after_data,change_id,sequence,reversal_of) VALUES (@audit_user_id,?, 'down_interval_notes', ?, ?, ?, @audit_change_id, (@audit_sequence := COALESCE(@audit_sequence,0)+1), NULL)")->execute([$previous===false?'add':'edit',$noteId,$previous===false?null:json_encode(['notes'=>$previous],JSON_THROW_ON_ERROR),json_encode(['tripId'=>$tripId,'intervalKey'=>$key,'notes'=>$notes],JSON_THROW_ON_ERROR)]);}
    if(($_POST['deleteImage']??'')==='1')$pdo->prepare('DELETE FROM down_interval_images WHERE trip_id=? AND interval_key=?')->execute([$tripId,$key]);
    if(isset($_FILES['image'])&&$_FILES['image']['error']!==UPLOAD_ERR_NO_FILE){if(!$interval['active'])api_error('A new photo can only be taken during active Down time.',409,'photo_capture_closed');if($_FILES['image']['error']!==UPLOAD_ERR_OK||$_FILES['image']['size']>8*1024*1024)api_error('Photo upload failed or exceeds 8 MB.',422,'invalid_image');$mime=(new finfo(FILEINFO_MIME_TYPE))->file($_FILES['image']['tmp_name']);if(!in_array($mime,['image/jpeg','image/png','image/webp','image/heic','image/heif'],true))api_error('Use a JPEG, PNG, WebP, or HEIC image.',422,'invalid_image');$exists=$pdo->prepare('SELECT 1 FROM down_interval_images WHERE trip_id=? AND interval_key=?');$exists->execute([$tripId,$key]);if($exists->fetchColumn())api_error('This Down interval already has a photo.',409,'image_exists');$blob=file_get_contents($_FILES['image']['tmp_name']);$pdo->prepare('INSERT INTO down_interval_images (trip_id,interval_key,mime_type,image) VALUES (?,?,?,?)')->execute([$tripId,$key,$mime,$blob]);}
    return ['saved'=>true];
});json_response($result);
